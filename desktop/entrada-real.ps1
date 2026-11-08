# Entrada REAL do Windows via SendInput (clique de mouse, digitacao e teclas).
param(
  [Parameter(Mandatory = $true)][string]$Acao,
  [int]$X = 0,
  [int]$Y = 0,
  [string]$Texto = $env:ENTRADA_TEXTO,
  [string]$Titulo = "Chaveiro Universal"
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential)]
public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
[StructLayout(LayoutKind.Sequential)]
public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
[StructLayout(LayoutKind.Explicit)]
public struct ENTRADA_UNIAO { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
[StructLayout(LayoutKind.Sequential)]
public struct INPUT { public uint type; public ENTRADA_UNIAO u; }
[StructLayout(LayoutKind.Sequential)]
public struct POINT { public int x; public int y; }
[StructLayout(LayoutKind.Sequential)]
public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
public static class Entrada {
  [DllImport("user32.dll", SetLastError = true)]
  public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")]
  public static extern IntPtr WindowFromPoint(POINT ponto);
  [DllImport("user32.dll")]
  public static extern IntPtr GetAncestor(IntPtr hWnd, uint gaFlags);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder s, int n);
  [DllImport("user32.dll")]
  public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
}
'@

function Enviar([INPUT[]]$eventos) {
  $tamanho = [int][System.Runtime.InteropServices.Marshal]::SizeOf([type][INPUT])
  $n = [Entrada]::SendInput([uint32]$eventos.Length, $eventos, $tamanho)
  if ($n -ne $eventos.Length) { throw "SendInput falhou ($n/$($eventos.Length))" }
}

# coordenadas sempre em pixeis fisicos (sem virtualizacao de DPI)
[void][Entrada]::SetProcessDPIAware()

function MontarMouse([uint32]$flags, [int]$x, [int]$y) {
  # structs sao value types em PowerShell: montar por partes e atribuir de volta
  $mi = New-Object MOUSEINPUT
  $mi.dx = $x
  $mi.dy = $y
  $mi.dwFlags = $flags
  $uniao = New-Object ENTRADA_UNIAO
  $uniao.mi = $mi
  $i = New-Object INPUT
  $i.type = 0
  $i.u = $uniao
  return $i
}

function MontarTecla([uint16]$scan, [uint32]$flags) {
  $ki = New-Object KEYBDINPUT
  $ki.wScan = $scan
  $ki.dwFlags = $flags
  $uniao = New-Object ENTRADA_UNIAO
  $uniao.ki = $ki
  $i = New-Object INPUT
  $i.type = 1
  $i.u = $uniao
  return $i
}

function MontarTeclaVk([uint16]$vk, [uint32]$flags) {
  $ki = New-Object KEYBDINPUT
  $ki.wVk = $vk
  $ki.dwFlags = $flags
  $uniao = New-Object ENTRADA_UNIAO
  $uniao.ki = $ki
  $i = New-Object INPUT
  $i.type = 1
  $i.u = $uniao
  return $i
}

switch ($Acao) {
  "mover" {
    # 0x8001 = MOVE absoluto (sem clique) — para testar hover real
    Enviar @((MontarMouse 0x8001 $X $Y))
  }
  "clicar" {
    # -X/-Y ja chegam normalizados em 0..65535 (calculo DPI-aware feito pelo Electron)
    Enviar @(
      (MontarMouse 0x8001 $X $Y),
      (MontarMouse 0x8002 $X $Y),
      (MontarMouse 0x8004 $X $Y)
    )
  }
  "clicar-px" {
    # -X/-Y em pixeis fisicos do desktop; normaliza aqui (processo DPI-aware)
    $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $nx = [int](($X / $b.Width) * 65535)
    $ny = [int](($Y / $b.Height) * 65535)
    Enviar @(
      (MontarMouse 0x8001 $nx $ny),
      (MontarMouse 0x8002 $nx $ny),
      (MontarMouse 0x8004 $nx $ny)
    )
  }
  "digitar" {
    foreach ($ch in $Texto.ToCharArray()) {
      $scan = [uint16][char]$ch
      Enviar @(
        (MontarTecla $scan 0x0004),
        (MontarTecla $scan 0x0006)
      )
      Start-Sleep -Milliseconds 25
    }
  }
  "tab" {
    Enviar @((MontarTeclaVk 0x09 0x0000), (MontarTeclaVk 0x09 0x0002))
  }
  "enter" {
    Enviar @((MontarTeclaVk 0x0D 0x0000), (MontarTeclaVk 0x0D 0x0002))
  }
  "esc" {
    Enviar @((MontarTeclaVk 0x1B 0x0000), (MontarTeclaVk 0x1B 0x0002))
  }
  "backspace" {
    Enviar @((MontarTeclaVk 0x08 0x0000), (MontarTeclaVk 0x08 0x0002))
  }
  "foco" {
    $h = [Entrada]::GetForegroundWindow()
    $sb = New-Object System.Text.StringBuilder 256
    [void][Entrada]::GetWindowText($h, $sb, 256)
    Write-Output $sb.ToString()
  }
  "minimizar" {
    $p = Get-Process | Where-Object { $_.MainWindowTitle -like "*$Titulo*" } | Select-Object -First 1
    if (-not $p) { throw "janela '$Titulo' nao encontrada" }
    [void][Entrada]::ShowWindow($p.MainWindowHandle, 6)
    Write-Output "minimizada"
  }
  "restaurar" {
    $p = Get-Process | Where-Object { $_.MainWindowTitle -like "*$Titulo*" } | Select-Object -First 1
    if (-not $p) { throw "janela '$Titulo' nao encontrada" }
    [void][Entrada]::ShowWindow($p.MainWindowHandle, 9)
    Write-Output "restaurada"
  }
  "ativar-janela" {
    $p = Get-Process | Where-Object { $_.MainWindowTitle -like "*$Titulo*" } | Select-Object -First 1
    if (-not $p) { throw "janela '$Titulo' nao encontrada" }
    [void][Entrada]::SetForegroundWindow($p.MainWindowHandle)
    Write-Output $p.MainWindowTitle
  }
  "rect-janela" {
    $p = Get-Process | Where-Object { $_.MainWindowTitle -like "*$Titulo*" } | Select-Object -First 1
    if (-not $p) { throw "janela '$Titulo' nao encontrada" }
    $r = New-Object RECT
    [void][Entrada]::GetWindowRect($p.MainWindowHandle, [ref]$r)
    Write-Output ("{0},{1},{2},{3}" -f $r.Left, $r.Top, $r.Right, $r.Bottom)
  }
  "janela-no-ponto" {
    $p = New-Object POINT
    $p.x = $X; $p.y = $Y
    $h = [Entrada]::WindowFromPoint($p)
    $raiz = [Entrada]::GetAncestor($h, 2)  # GA_ROOT
    $sb = New-Object System.Text.StringBuilder 256
    [void][Entrada]::GetWindowText($raiz, $sb, 256)
    $classe = New-Object System.Text.StringBuilder 256
    [void][Entrada]::GetClassName($raiz, $classe, 256)
    Write-Output ("titulo=[" + $sb.ToString() + "] classe=[" + $classe.ToString() + "]")
  }
  default { throw "acao desconhecida: $Acao" }
}
