# Traces a whole template-sized drawing without cropping, so it keeps its place on the template.
import sys, vtracer
from PIL import Image, ImageFilter
src, png, svg, k = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
im = Image.open(src).convert('RGBA')
big = im.resize((im.width * k, im.height * k), Image.BICUBIC)
al = big.getchannel('A').point(lambda v: 255 if v > 90 else 0).filter(ImageFilter.GaussianBlur(k * 0.9)).point(lambda v: 255 if v > 127 else 0)
rgb = big.convert('RGB').filter(ImageFilter.MedianFilter(3))
Image.merge('RGBA', (*rgb.split(), al)).save(png)
vtracer.convert_image_to_svg_py(png, svg, colormode='color', hierarchical='stacked', mode='spline', filter_speckle=10,
    color_precision=7, layer_difference=12, corner_threshold=90, length_threshold=8.0, max_iterations=10, splice_threshold=60, path_precision=1)
print(big.size, Image.open(src).size)
