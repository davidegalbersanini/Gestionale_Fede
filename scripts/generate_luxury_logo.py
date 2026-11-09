import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_app_icon(size=512):
    # High-res canvas with 2x supersampling for crisp anti-aliasing
    scale = 2
    actual_size = size * scale
    img = Image.new('RGBA', (actual_size, actual_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded rectangle background with obsidian gradient
    radius = int(actual_size * 0.22) # Apple squircle curvature
    
    # Gradient background
    bg = Image.new('RGBA', (actual_size, actual_size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    bg_draw.rounded_rectangle([0, 0, actual_size, actual_size], radius=radius, fill=(18, 16, 23, 255))
    
    # Layer gradient
    for y in range(actual_size):
        factor = y / actual_size
        # Deep dark purple-black to rose-black
        r = int(24 + factor * 20)
        g = int(18 + factor * 10)
        b = int(28 + factor * 16)
        bg_draw.line([(0, y), (actual_size, y)], fill=(r, g, b, 255))

    # Mask with rounded rectangle
    mask = Image.new('L', (actual_size, actual_size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([0, 0, actual_size, actual_size], radius=radius, fill=255)
    
    final_icon = Image.new('RGBA', (actual_size, actual_size), (0, 0, 0, 0))
    final_icon.paste(bg, (0, 0), mask=mask)
    draw = ImageDraw.Draw(final_icon)

    # Subtle inner border glow
    border_width = int(actual_size * 0.015)
    draw.rounded_rectangle(
        [border_width, border_width, actual_size - border_width, actual_size - border_width],
        radius=radius - border_width,
        outline=(244, 63, 94, 60),
        width=border_width
    )

    cx, cy = actual_size // 2, actual_size // 2

    # Outer decorative glow ring
    ring_radius = int(actual_size * 0.36)
    for r in range(ring_radius - 10, ring_radius + 10):
        alpha = int(40 * (1 - abs(r - ring_radius) / 10))
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(244, 63, 94, alpha), width=2)

    # Draw luxury stylized monogram 'F'
    # Main vertical stem
    stem_w = int(actual_size * 0.065)
    stem_x = cx - int(actual_size * 0.12)
    stem_top = cy - int(actual_size * 0.26)
    stem_bottom = cy + int(actual_size * 0.26)
    
    # Vertical gradient stem
    for y in range(stem_top, stem_bottom):
        frac = (y - stem_top) / (stem_bottom - stem_top)
        # Rose gold to coral
        cr = int(251 - frac * 10)
        cg = int(113 + frac * 50)
        cb = int(133 + frac * 20)
        draw.line([(stem_x, y), (stem_x + stem_w, y)], fill=(cr, cg, cb, 255))
        
    # Top horizontal arm
    arm_top_len = int(actual_size * 0.28)
    for x in range(stem_x, stem_x + arm_top_len):
        frac = (x - stem_x) / arm_top_len
        cr = int(251 - frac * 20)
        cg = int(113 + frac * 40)
        cb = int(133 - frac * 30)
        draw.line([(x, stem_top), (x, stem_top + stem_w)], fill=(cr, cg, cb, 255))
        
    # Serif on top arm
    draw.polygon([
        (stem_x + arm_top_len, stem_top),
        (stem_x + arm_top_len + int(actual_size * 0.02), stem_top + int(actual_size * 0.04)),
        (stem_x + arm_top_len, stem_top + stem_w)
    ], fill=(244, 63, 94, 255))

    # Middle horizontal arm
    mid_y = cy - int(actual_size * 0.02)
    arm_mid_len = int(actual_size * 0.20)
    for x in range(stem_x, stem_x + arm_mid_len):
        frac = (x - stem_x) / arm_mid_len
        cr = int(244 + frac * 10)
        cg = int(63 + frac * 80)
        cb = int(94 + frac * 50)
        draw.line([(x, mid_y), (x, mid_y + int(stem_w * 0.85))], fill=(cr, cg, cb, 255))

    # Bottom serif on stem
    serif_w = int(actual_size * 0.07)
    draw.rounded_rectangle([stem_x - serif_w // 2, stem_bottom - int(stem_w * 0.6), stem_x + stem_w + serif_w // 2, stem_bottom], radius=4, fill=(244, 63, 94, 255))

    # Draw 4-point sparkles (Aesthetic beauty elements)
    def draw_sparkle(center_x, center_y, sp_size, color):
        points = []
        for i in range(8):
            angle = i * (math.pi / 4)
            r = sp_size if (i % 2 == 0) else (sp_size * 0.25)
            px = center_x + r * math.cos(angle)
            py = center_y + r * math.sin(angle)
            points.append((px, py))
        draw.polygon(points, fill=color)

    # Sparkle 1: Top right
    draw_sparkle(cx + int(actual_size * 0.22), cy - int(actual_size * 0.20), int(actual_size * 0.09), (255, 230, 240, 255))
    # Sparkle 2: Lower right small
    draw_sparkle(cx + int(actual_size * 0.18), cy + int(actual_size * 0.16), int(actual_size * 0.05), (251, 191, 36, 240))
    # Sparkle 3: Tiny left
    draw_sparkle(cx - int(actual_size * 0.24), cy - int(actual_size * 0.08), int(actual_size * 0.04), (244, 63, 94, 220))

    # Downsample with high-quality Lanczos resampling
    result = final_icon.resize((size, size), Image.Resampling.LANCZOS)
    return result

# Generate icons
icon_512 = create_app_icon(512)
icon_192 = create_app_icon(192)
icon_apple = create_app_icon(180)
icon_favicon = create_app_icon(64)

# Save
icon_512.save(r"c:\Users\User\Desktop\Gestionale_Fede\public\icon-512.png", "PNG")
icon_192.save(r"c:\Users\User\Desktop\Gestionale_Fede\public\icon-192.png", "PNG")
icon_apple.save(r"c:\Users\User\Desktop\Gestionale_Fede\public\apple-touch-icon.png", "PNG")
icon_favicon.save(r"c:\Users\User\Desktop\Gestionale_Fede\public\favicon.ico", format="ICO")

print("All luxury icons generated successfully!")

