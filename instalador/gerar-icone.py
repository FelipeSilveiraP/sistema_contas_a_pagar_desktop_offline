"""Gera o emblema do sistema (cadeado laranja com haste amarela, sem fundo) em todos os tamanhos.

Saidas:
  instalador/icone.ico         -> .exe do sistema, instalador, atalhos (16 a 256 px)
  frontend/assets/icone.png    -> icone da janela e da barra de tarefas (256 px)

Uso: python instalador/gerar-icone.py   (precisa do Pillow: pip install pillow)
Desenho em 1024 px (formas retas, cores do sistema) e reducao para cada tamanho.
"""
from pathlib import Path

from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
PRETO = (28, 27, 27, 255)       # #1c1b1b
AMARELO = (255, 230, 0, 255)    # #FFE600 (cor do Menu)
LARANJA = (255, 140, 0, 255)    # #FF8C00 (cor da chave)


def desenhar(lado: int = 1024) -> Image.Image:
    """So o cadeado, sem placa de fundo, ocupando a imagem inteira (fica maior na
    barra de tarefas). Haste amarela e corpo laranja, com contorno preto grosso
    para aparecer tanto na barra clara quanto na escura."""
    img = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    u = lado / 1024  # unidade
    VAZIO = (0, 0, 0, 0)

    def ret(x0, y0, x1, y1, cor):
        # ImageDraw substitui o pixel (sem mistura): VAZIO "recorta" o desenho
        d.rectangle([x0 * u, y0 * u, x1 * u, y1 * u], fill=cor)

    # haste (U quadrado): contorno preto, miolo amarelo, vao transparente
    ret(212, 16, 812, 520, PRETO)
    ret(252, 56, 772, 520, AMARELO)
    ret(368, 172, 656, 520, PRETO)
    ret(408, 212, 616, 520, VAZIO)

    # corpo: contorno preto + laranja, quase da largura toda
    ret(40, 420, 984, 1008, PRETO)
    ret(84, 464, 940, 964, LARANJA)

    # buraco da fechadura (quadrado + rasgo, sem curvas)
    ret(440, 584, 584, 728, PRETO)
    ret(480, 720, 544, 880, PRETO)
    return img


def main() -> None:
    grande = desenhar(1024)
    tamanhos = [16, 20, 24, 32, 40, 48, 64, 128, 256]
    imagens = [grande.resize((t, t), Image.LANCZOS) for t in tamanhos]
    ico = RAIZ / "instalador" / "icone.ico"
    imagens[-1].save(ico, format="ICO", sizes=[(t, t) for t in tamanhos], append_images=imagens[:-1])
    png = RAIZ / "frontend" / "assets" / "icone.png"
    imagens[-1].save(png, format="PNG", optimize=True)
    print(f"gerados: {ico} ({ico.stat().st_size // 1024} KB) e {png} ({png.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
