"""Gera o emblema do sistema (cadeado neobrutalista) em todos os tamanhos.

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
    img = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    u = lado / 1024  # unidade

    def ret(x0, y0, x1, y1, cor):
        d.rectangle([x0 * u, y0 * u, x1 * u, y1 * u], fill=cor)

    # placa amarela com contorno grosso e sombra dura (deslocada para baixo/direita)
    ret(152, 152, 960, 960, PRETO)          # sombra
    ret(64, 64, 872, 872, PRETO)            # contorno
    ret(120, 120, 816, 816, AMARELO)        # placa

    # haste do cadeado (U quadrado, grosso)
    ret(300, 196, 636, 276, PRETO)          # barra de cima
    ret(300, 196, 380, 470, PRETO)          # perna esquerda
    ret(556, 196, 636, 470, PRETO)          # perna direita

    # corpo do cadeado: sombra dura + contorno + laranja
    ret(248, 452, 744, 776, PRETO)          # sombra do corpo
    ret(212, 416, 708, 740, PRETO)          # contorno
    ret(260, 464, 660, 692, LARANJA)        # corpo

    # buraco da fechadura (quadrado + rasgo, sem curvas)
    ret(418, 512, 502, 596, PRETO)
    ret(440, 592, 480, 664, PRETO)
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
