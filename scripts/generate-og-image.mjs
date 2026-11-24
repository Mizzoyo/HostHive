import sharp from 'sharp';

sharp('public/images/hero.jpg')
  .resize(1200, 630, { fit: 'cover' })
  .jpeg({ quality: 80 })
  .toFile('public/images/og-image.jpg')
  .then((info) => console.log('Wrote public/images/og-image.jpg', info));
