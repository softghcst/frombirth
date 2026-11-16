// Eyebrows. Drawn as a stroke for the brow on the viewer's right, centred on
// (0,0) with the outer end at +x; the renderer mirrors it and places it above
// the eye. `weight` is the stroke width, so the same curve can be fine or bold.
// IDs are saved in characters: never rename or remove one, only add.
export const BROWS = [
  { id: 'straight', name: 'Straight, fine', d: 'M-6.6 0.4L6.8-0.9', weight: 1.5 },
  { id: 'straight_bold', name: 'Straight, bold', d: 'M-6.6 0.4L6.8-0.9', weight: 2.9 },
  { id: 'soft_arch', name: 'Soft arch, fine', d: 'M-6.6 1.2Q0.5-3.2 7.2 0.2', weight: 1.5 },
  { id: 'soft_arch_bold', name: 'Soft arch, bold', d: 'M-6.6 1.2Q0.5-3.2 7.2 0.2', weight: 2.9 },
  { id: 'sharp_arch', name: 'Sharp arch, fine', d: 'M-6.6 1.8L2.8-2.8L7.6 0.6', weight: 1.5 },
  { id: 'sharp_arch_bold', name: 'Sharp arch, bold', d: 'M-6.6 1.8L2.8-2.8L7.6 0.6', weight: 2.9 },
  { id: 'rounded', name: 'Rounded', d: 'M-6.4 1.6Q-3-3.4 1-3Q5-2.6 7 1.2', weight: 2.1 },
];
