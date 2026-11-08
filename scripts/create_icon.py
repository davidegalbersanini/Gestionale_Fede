import zlib
import struct

def make_png(width, height, color_rgb):
    # PNG signature
    png = b'\x89PNG\r\n\x1a\n'
    
    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
    png += struct.pack('>I', len(ihdr_data)) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)
    
    # IDAT (raw image data)
    r, g, b = color_rgb
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0) # filter byte 0
        for x in range(width):
            # smooth subtle gradient towards rose/pink
            dr = int(r * (1 - 0.2 * (y / height)))
            dg = int(g * (1 - 0.2 * (x / width)))
            db = int(b * (1 - 0.1 * (y / height)))
            raw_data.extend([dr, dg, db])
            
    compressed = zlib.compress(bytes(raw_data))
    idat_crc = zlib.crc32(b'IDAT' + compressed)
    png += struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', idat_crc)
    
    # IEND
    iend_crc = zlib.crc32(b'IEND')
    png += struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)
    
    return png

# Rose/Pink luxury brand color (225, 29, 72)
icon_192 = make_png(192, 192, (225, 29, 72))
icon_512 = make_png(512, 512, (225, 29, 72))

with open(r"c:\Users\User\Desktop\Gestionale_Fede\public\icon-192.png", "wb") as f:
    f.write(icon_192)

with open(r"c:\Users\User\Desktop\Gestionale_Fede\public\icon-512.png", "wb") as f:
    f.write(icon_512)

print("Icons created successfully!")

