/* =============================================================================
 * content/skins.js - Durian skins sold in the Tanooki Store.
 * -----------------------------------------------------------------------------
 * A skin is a CSS filter chain applied straight to the durian image:
 *
 *     grayscale(1) sepia(1) saturate(sat) hue-rotate(hue) brightness() contrast()
 *
 * grayscale flattens the fruit's own colour, sepia lays a warm base down,
 * saturate pushes it hard and hue-rotate swings it to the target colour. This
 * replaced an approach using mix-blend-mode over a masked overlay, which was
 * far too subtle in practice - the durian just looked grey.
 *
 * Because it is one filter on one image it works with whatever art sits in
 * CONFIG.assets.durian, needs no blending support, and cannot be defeated by a
 * stacking context.
 *
 * `animated: true` cycles the hue continuously.
 *
 * A skin may instead WEAR an image (`css.image` names a key in CONFIG.assets):
 * art drawn on top of the fruit at full size, so a hat lands on the top and a
 * moustache across the middle. It tracks every wobble, bounce and squash the
 * durian does. `css.opacity` is there if you want it see-through, but defaults
 * to solid. Reward skins carry `reward: true` and a `requires` condition
 * instead of a cost — they cannot be bought at any price.
 * `swatch` is the flat colour shown in the store and picker.
 *
 * IDS ARE SAVE KEYS. Never rename one after release.
 * ========================================================================== */
(function (DC) {
  'use strict';
  var CONFIG = DC.CONFIG;

  CONFIG.skins = CONFIG.skins.concat([
    { id: 'classic', name: 'Classic Durian', tier: 'Standard', cost: 0,
      swatch: '#8FBF3F',
      description: 'The original. Spiky, pungent, dependable.',
      css: {} },
    { id: 'sunset', name: 'Sunset Ripe', tier: 'Tints', cost: 250000,
      swatch: '#FF6B2B',
      description: 'Picked at golden hour, when the whole island turns orange.',
      css: { hue: -22, sat: 4.0, bright: 1.02, contrast: 1.05 } },
    { id: 'bianco', name: 'Bianco Blue', tier: 'Tints', cost: 900000,
      swatch: '#2E8FE0',
      description: 'The exact blue of the water below the windmill.',
      css: { hue: 165, sat: 4.5, bright: 1.0, contrast: 1.1 } },
    { id: 'noki', name: 'Noki Shell', tier: 'Tints', cost: 3500000,
      swatch: '#E86BC4',
      description: 'Pearlescent, faintly iridescent, smells no better for it.',
      css: { hue: -85, sat: 3.5, bright: 1.08, contrast: 1.05 } },
    { id: 'goop', name: 'Graffiti Goop', tier: 'Tints', cost: 12000000,
      swatch: '#8A3FD6',
      description: 'Somebody painted it. Nobody has admitted to it.',
      css: { hue: -122, sat: 5.0, bright: 0.95, contrast: 1.2 } },
    { id: 'watermelon', name: 'Watermelon Mix-Up', tier: 'Tints', cost: 45000000,
      swatch: '#35C64B',
      description: 'Botanically incorrect. Nobody on the island minds.',
      css: { hue: 95, sat: 5.0, bright: 1.05, contrast: 1.1 } },
    { id: 'sherbet', name: 'Delfino Sherbet', tier: 'Gradients', cost: 200000000,
      swatch: '#FF5FA8',
      description: 'Three flavours, one fruit, no explanation.',
      css: { hue: -70, sat: 4.0, bright: 1.12, contrast: 1.0 } },
    { id: 'sunrise', name: 'Airstrip Sunrise', tier: 'Gradients', cost: 900000000,
      swatch: '#F0345E',
      description: 'The view from the runway at five in the morning.',
      css: { hue: -50, sat: 4.5, bright: 1.05, contrast: 1.15 } },
    { id: 'corona', name: 'Corona Magma', tier: 'Gradients', cost: 4000000000,
      swatch: '#FF3B0A',
      description: 'Still warm. Handle with the gloves you bought earlier.',
      css: { hue: -32, sat: 6.0, bright: 1.1, contrast: 1.3 } },
    { id: 'abyss', name: 'Noki Bay Abyss', tier: 'Gradients', cost: 20000000000,
      swatch: '#0FA0B8',
      description: 'Grown at a depth the surveys never reached.',
      css: { hue: 148, sat: 5.0, bright: 0.85, contrast: 1.25 } },
    { id: 'shimmer', name: 'Shine Shimmer', tier: 'Animated', cost: 100000000000,
      swatch: '#FFC400',
      description: 'A Shine Sprite got a little too close and it never wore off.',
      css: { hue: 10, sat: 5.0, bright: 1.15, contrast: 1.05, hue2: 12, sat2: 0.6, bright2: 1.75, contrast2: 0.95, secs: 2.2 } },
    { id: 'tide', name: 'Rolling Tide', tier: 'Animated', cost: 600000000000,
      swatch: '#00B4D8',
      description: 'The colours move like water because, technically, they are water.',
      css: { hue: 152, sat: 5.5, bright: 0.8, contrast: 1.2, hue2: 146, sat2: 3.0, bright2: 1.35, contrast2: 0.95, secs: 4.5 } },
    { id: 'festival', name: 'Festival Lights', tier: 'Animated', cost: 3000000000000,
      swatch: '#FF2D8A',
      description: 'The Plaza strings lanterns all along the harbour for this one.',
      css: { hue: -82, sat: 5.5, bright: 1.1, contrast: 1.15, cycle: true, secs: 6 } },
    { id: 'shadow', name: 'Shadow Paint', tier: 'Animated', cost: 20000000000000,
      swatch: '#7B2DD6',
      description: 'It keeps shifting when you are not looking directly at it.',
      css: { hue: -132, sat: 5.5, bright: 0.95, contrast: 1.3, hue2: -128, sat2: 2.0, bright2: 0.28, contrast2: 1.8, secs: 3.2 } },
    { id: 'tiles', name: 'Roof Tiles', tier: 'Patterns', cost: 100000000000000,
      swatch: '#D93A18',
      description: 'Every roof in Delfino Plaza, fired into one husk.',
      css: { hue: -28, sat: 5.5, bright: 0.95, contrast: 1.45 } },
    { id: 'stripes', name: 'Beach Umbrella', tier: 'Patterns', cost: 800000000000000,
      swatch: '#FF1744',
      description: 'Gelato Beach standard issue. Sold separately from the umbrella.',
      css: { hue: -48, sat: 6.0, bright: 1.15, contrast: 1.5 } },
    { id: 'circuit', name: 'FLUDD Schematic', tier: 'Patterns', cost: 5000000000000000,
      swatch: '#00C8E8',
      description: 'Technical drawings, printed directly onto the husk.',
      css: { hue: 150, sat: 6.0, bright: 1.2, contrast: 1.6 } },
    { id: 'goldleaf', name: 'Gold Leaf', tier: 'Prestige', cost: 40000000000000000,
      swatch: '#FFD11A',
      description: 'Edible, allegedly. Nobody has been brave enough to check.',
      css: { hue: 2, sat: 6.0, bright: 0.95, contrast: 1.35, hue2: 8, sat2: 4.0, bright2: 1.6, contrast2: 1.05, secs: 3.6 } },
    { id: 'bluecoin', name: 'Blue Coin Finish', tier: 'Prestige', cost: 200000000000000000,
      swatch: '#1E90FF',
      description: 'The colour of the thing you were supposed to be collecting.',
      css: { hue: 172, sat: 6.0, bright: 0.85, contrast: 1.35, hue2: 156, sat2: 3.5, bright2: 1.5, contrast2: 1.0, secs: 2.6 } },
    { id: 'mario', name: 'The Man Himself', tier: 'Earned', cost: null,
      swatch: '#DC322D',
      description: 'A year on Isle Delfino. Somebody lent it the hat.',
      reward: true,
      requires: { type: 'playTime', seconds: 31536000 },
      requirementText: 'Play for 365 days',
      css: { image: 'marioFace', opacity: 1.0 } }
  ]);
})(window.DC = window.DC || {});
