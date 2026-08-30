/* =============================================================================
 * content/skins.js — Durian skins sold in the Tanooki Store.
 * -----------------------------------------------------------------------------
 * Skins are pure CSS, not artwork: a filter on the durian image plus an
 * optional tinted overlay masked to the durian's own silhouette. That means
 * every skin automatically works with whatever art you put in
 * CONFIG.assets.durian — replace the durian and all 18 skins still fit it.
 *
 *   filter     applied to the image
 *   overlay    a background painted over the fruit shape only
 *   blend      how the overlay mixes (color / overlay / hue / screen)
 *   animation  CSS animation shorthand, for the moving ones
 *   size       background-size for animated gradients (needs room to travel)
 *
 * IDS ARE SAVE KEYS. Never rename one after release.
 * ========================================================================== */
(function (DC) {
  'use strict';
  var CONFIG = DC.CONFIG;

  CONFIG.skins = CONFIG.skins.concat([

    /* ------------------------------------------------------------ free -- */
    { id: 'classic', name: 'Classic Durian', tier: 'Standard', cost: 0,
      description: 'The original. Spiky, pungent, dependable.',
      css: {} },

    /* ----------------------------------------------------- simple tints -- */
    { id: 'sunset', name: 'Sunset Ripe', tier: 'Tints', cost: 250000,
      description: 'Picked at golden hour, when the whole island turns orange.',
      css: { filter: 'saturate(1.3)', overlay: 'linear-gradient(160deg,#FF9E3D,#FF5F4D)', blend: 'color' } },

    { id: 'bianco', name: 'Bianco Blue', tier: 'Tints', cost: 900000,
      description: 'The exact blue of the water below the windmill.',
      css: { overlay: 'linear-gradient(160deg,#63D4FF,#1E6FC4)', blend: 'color' } },

    { id: 'noki', name: 'Noki Shell', tier: 'Tints', cost: 3500000,
      description: 'Pearlescent, faintly iridescent, smells no better for it.',
      css: { filter: 'brightness(1.08)', overlay: 'linear-gradient(150deg,#FFE9F2,#B79BE0,#8FD9E8)', blend: 'color' } },

    { id: 'goop', name: 'Graffiti Goop', tier: 'Tints', cost: 12000000,
      description: 'Somebody painted it. Nobody has admitted to it.',
      css: { filter: 'contrast(1.15)', overlay: 'radial-gradient(circle at 35% 30%,#B662E8,#4B1E7A)', blend: 'color' } },

    { id: 'watermelon', name: 'Watermelon Mix-Up', tier: 'Tints', cost: 45000000,
      description: 'Botanically incorrect. Nobody on the island minds.',
      css: { overlay: 'linear-gradient(150deg,#6FD96F 0%,#6FD96F 45%,#FF6B7E 46%,#FF3355 100%)', blend: 'color' } },

    /* -------------------------------------------------------- gradients -- */
    { id: 'sherbet', name: 'Delfino Sherbet', tier: 'Gradients', cost: 2e8,
      description: 'Three flavours, one fruit, no explanation.',
      css: { filter: 'saturate(1.2)', overlay: 'linear-gradient(135deg,#FF9CC4,#FFD86F,#7BE0C6)', blend: 'color' } },

    { id: 'sunrise', name: 'Airstrip Sunrise', tier: 'Gradients', cost: 9e8,
      description: 'The view from the runway at five in the morning.',
      css: { overlay: 'linear-gradient(180deg,#2B2A6E 0%,#C94E8C 45%,#FFB65C 100%)', blend: 'color' } },

    { id: 'corona', name: 'Corona Magma', tier: 'Gradients', cost: 4e9,
      description: 'Still warm. Handle with the gloves you bought earlier.',
      css: { filter: 'brightness(1.1) contrast(1.2)',
             overlay: 'radial-gradient(circle at 45% 65%,#FFE066 0%,#FF7A18 35%,#8C1A00 100%)', blend: 'color' } },

    { id: 'abyss', name: 'Noki Bay Abyss', tier: 'Gradients', cost: 2e10,
      description: 'Grown at a depth the surveys never reached.',
      css: { filter: 'brightness(0.92)',
             overlay: 'radial-gradient(circle at 40% 30%,#3BE0D0 0%,#12518F 45%,#050B33 100%)', blend: 'color' } },

    /* --------------------------------------------------------- animated -- */
    { id: 'shimmer', name: 'Shine Shimmer', tier: 'Animated', cost: 1e11,
      description: 'A Shine Sprite got a little too close and it never wore off.',
      css: { overlay: 'linear-gradient(110deg,#FFD429,#FFF6C2,#FFB03A,#FFD429)',
             blend: 'color', size: '300% 300%', animation: 'skinDrift 6s linear infinite' } },

    { id: 'tide', name: 'Rolling Tide', tier: 'Animated', cost: 6e11,
      description: 'The colours move like water because, technically, they are water.',
      css: { overlay: 'linear-gradient(100deg,#0FA5C9,#8FE3F6,#2FB3DE,#0FA5C9)',
             blend: 'color', size: '300% 300%', animation: 'skinDrift 8s linear infinite' } },

    { id: 'festival', name: 'Festival Lights', tier: 'Animated', cost: 3e12,
      description: 'The Plaza strings lanterns all along the harbour for this one.',
      css: { overlay: 'linear-gradient(90deg,#FF5F6D,#FFC371,#42E695,#3BB2B8,#FF5F6D)',
             blend: 'color', size: '400% 400%', animation: 'skinDrift 5s linear infinite' } },

    { id: 'shadow', name: 'Shadow Paint', tier: 'Animated', cost: 2e13,
      description: 'It keeps shifting when you are not looking directly at it.',
      css: { filter: 'contrast(1.2)',
             overlay: 'linear-gradient(120deg,#2B1B57,#7A3FBF,#1E1140,#7A3FBF)',
             blend: 'color', size: '300% 300%', animation: 'skinDrift 4s linear infinite' } },

    /* --------------------------------------------------------- patterns -- */
    { id: 'tiles', name: 'Roof Tiles', tier: 'Patterns', cost: 1e14,
      description: 'Every roof in Delfino Plaza, rendered on a single fruit.',
      css: { overlay: 'repeating-linear-gradient(45deg,#E2563B 0 12px,#B93C24 12px 24px)', blend: 'color' } },

    { id: 'stripes', name: 'Beach Umbrella', tier: 'Patterns', cost: 8e14,
      description: 'Gelato Beach standard issue. Sold separately from the umbrella.',
      css: { overlay: 'repeating-linear-gradient(0deg,#FF5F6D 0 14px,#FFF6E0 14px 28px)', blend: 'color' } },

    { id: 'circuit', name: 'FLUDD Schematic', tier: 'Patterns', cost: 5e15,
      description: 'Technical drawings, printed directly onto the husk.',
      css: { filter: 'brightness(1.05)',
             overlay: 'repeating-linear-gradient(90deg,#0FA5C9 0 3px,transparent 3px 18px),' +
                      'repeating-linear-gradient(0deg,#0FA5C9 0 3px,transparent 3px 18px)',
             blend: 'overlay' } },

    /* ------------------------------------------------------------ prize -- */
    { id: 'goldleaf', name: 'Gold Leaf', tier: 'Prestige', cost: 4e16,
      description: 'Edible, allegedly. Nobody has been brave enough to check.',
      css: { filter: 'brightness(1.15) contrast(1.1)',
             overlay: 'linear-gradient(135deg,#8A6510,#FFE9A3,#D79806,#FFF6D0,#8A6510)',
             blend: 'color', size: '300% 300%', animation: 'skinDrift 7s linear infinite' } },

    { id: 'bluecoin', name: 'Blue Coin Finish', tier: 'Prestige', cost: 2e17,
      description: 'The colour of the thing you were supposed to be collecting.',
      css: { filter: 'brightness(1.1)',
             overlay: 'radial-gradient(circle at 38% 32%,#BFF0FF 0%,#46A5F0 40%,#0B4FA8 100%)',
             blend: 'color' } }
  ]);
})(window.DC = window.DC || {});
