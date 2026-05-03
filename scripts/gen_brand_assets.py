"""Generate logo (512x512) and banner (640x360) PNGs from the TollgateLogo SVG."""
import math
import os
import cairosvg

ACCENT = "#FF3300"
BG     = "#0a0a0a"
BG2    = "#111111"


def logo_svg(size: int) -> str:
    """Reproduce TollgateLogo SVG at arbitrary size with dark background."""
    cx = cy = size / 2
    pad = size * 0.08
    r_outer = size / 2 - pad
    r_inner = r_outer * 0.5

    dots_outer = []
    for i in range(16):
        angle = (i * 360) / 16
        rad = math.radians(angle)
        x = cx + r_outer * math.cos(rad)
        y = cy + r_outer * math.sin(rad)
        dot = size * 0.055 if i % 2 == 0 else size * 0.035
        dots_outer.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{dot:.2f}" fill="{ACCENT}"/>')

    dots_inner = []
    for i in range(8):
        angle = (i * 360) / 8 + 22.5
        rad = math.radians(angle)
        x = cx + r_inner * math.cos(rad)
        y = cy + r_inner * math.sin(rad)
        dot = size * 0.030
        dots_inner.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{dot:.2f}" fill="{ACCENT}" opacity="0.6"/>')

    center_r = size * 0.0625
    center = f'<circle cx="{cx}" cy="{cy}" r="{center_r:.2f}" fill="{ACCENT}"/>'

    bg = f'<rect width="{size}" height="{size}" fill="{BG}" rx="{size*0.18:.1f}"/>'

    return (
        f'<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" '
        f'xmlns="http://www.w3.org/2000/svg">'
        + bg
        + "\n".join(dots_outer)
        + "\n".join(dots_inner)
        + center
        + "</svg>"
    )


def banner_svg(w: int, h: int) -> str:
    """Banner: dark background, logo left, wordmark right."""
    logo_size = int(h * 0.42)
    logo_x = int(h * 0.18)
    logo_y = (h - logo_size) // 2

    cx = logo_x + logo_size / 2
    cy = logo_y + logo_size / 2
    pad = logo_size * 0.08
    r_outer = logo_size / 2 - pad
    r_inner = r_outer * 0.5

    dots_outer = []
    for i in range(16):
        angle = (i * 360) / 16
        rad = math.radians(angle)
        x = cx + r_outer * math.cos(rad)
        y = cy + r_outer * math.sin(rad)
        dot = logo_size * 0.055 if i % 2 == 0 else logo_size * 0.035
        dots_outer.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{dot:.2f}" fill="{ACCENT}"/>')

    dots_inner = []
    for i in range(8):
        angle = (i * 360) / 8 + 22.5
        rad = math.radians(angle)
        x = cx + r_inner * math.cos(rad)
        y = cy + r_inner * math.sin(rad)
        dot = logo_size * 0.030
        dots_inner.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{dot:.2f}" fill="{ACCENT}" opacity="0.6"/>')

    center_r = logo_size * 0.0625
    center_dot = f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{center_r:.2f}" fill="{ACCENT}"/>'

    # wordmark — two lines, mono font fallback
    text_x = logo_x + logo_size + int(h * 0.10)
    name_y = h // 2 - int(h * 0.03)
    sub_y  = h // 2 + int(h * 0.12)
    fs_name = int(h * 0.155)
    fs_sub  = int(h * 0.052)

    # subtle horizontal rule across bottom third
    rule_y = int(h * 0.72)

    return (
        f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg">'
        # background
        f'<rect width="{w}" height="{h}" fill="{BG}"/>'
        # subtle grid lines
        + "".join(
            f'<line x1="0" y1="{int(h*i/6)}" x2="{w}" y2="{int(h*i/6)}" stroke="#ffffff" stroke-width="0.4" opacity="0.04"/>'
            for i in range(1, 6)
        )
        + "".join(
            f'<line x1="{int(w*i/10)}" y1="0" x2="{int(w*i/10)}" y2="{h}" stroke="#ffffff" stroke-width="0.4" opacity="0.04"/>'
            for i in range(1, 10)
        )
        # logo dots
        + "\n".join(dots_outer)
        + "\n".join(dots_inner)
        + center_dot
        # divider
        + f'<line x1="{text_x - int(h*0.04)}" y1="{int(h*0.22)}" x2="{text_x - int(h*0.04)}" y2="{int(h*0.78)}" stroke="{ACCENT}" stroke-width="1.5" opacity="0.35"/>'
        # wordmark
        + f'<text x="{text_x}" y="{name_y}" font-family="monospace" font-size="{fs_name}" font-weight="700" fill="#ffffff" letter-spacing="-1">TOLLGATE</text>'
        + f'<text x="{text_x}" y="{sub_y}" font-family="monospace" font-size="{fs_sub}" fill="{ACCENT}" letter-spacing="1" opacity="0.85">STRIPE FOR AGENT-TO-AGENT CALLS</text>'
        + "</svg>"
    )


def main():
    out = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    logo = logo_svg(512)
    cairosvg.svg2png(bytestring=logo.encode(), write_to=os.path.join(out, "logo.png"))
    print("✓ logo.png  (512×512)")

    banner = banner_svg(640, 360)
    cairosvg.svg2png(bytestring=banner.encode(), write_to=os.path.join(out, "banner.png"))
    print("✓ banner.png (640×360)")


if __name__ == "__main__":
    main()
