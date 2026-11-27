"""The iOS app's icon and launch image, from the game's own artwork. Run: python3 scripts/make-app-images.py

- App icon: icons/icon-afterglow-1024.png (Afterglow, the icon an install uses), flattened to RGB as Apple requires.
- Launch image: the From Birth logo, centered on the light background colour (#F1EBFA), 2732 x 2732.
"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
assets = root / 'ios/App/App/Assets.xcassets'

icon = Image.open(root / 'icons/icon-afterglow-1024.png').convert('RGB')
assert icon.size == (1024, 1024)
icon.save(assets / 'AppIcon.appiconset/AppIcon-512@2x.png', optimize=True)

bg = (0xF1, 0xEB, 0xFA)
logo = Image.open(root / 'assets/branding/from_birth_logo-640.png').convert('RGBA')
w = 900
logo = logo.resize((w, round(logo.height * w / logo.width)), Image.LANCZOS)
splash = Image.new('RGB', (2732, 2732), bg)
splash.paste(logo, ((2732 - logo.width) // 2, (2732 - logo.height) // 2), logo)
for name in ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']:
    splash.save(assets / 'Splash.imageset' / name, optimize=True)
print('icon and launch images written to', assets.relative_to(root))
