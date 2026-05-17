import { Jimp } from 'jimp';

async function removeWhiteBackground(filePath) {
  try {
    const image = await Jimp.read(filePath);
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
      const red   = this.bitmap.data[idx + 0];
      const green = this.bitmap.data[idx + 1];
      const blue  = this.bitmap.data[idx + 2];

      // If white or close to white, make transparent
      if (red > 240 && green > 240 && blue > 240) {
        this.bitmap.data[idx + 3] = 0; 
      }
    });
    await image.write(filePath);
    console.log('Processed', filePath);
  } catch (err) {
    console.error('Error processing', filePath, err);
  }
}

const files = [
  'public/mallard_duck.png', 
  'public/white_duck.png', 
  'public/rubber_duck.png', 
  'public/tree_obstacle.png'
];

async function run() {
  for (const f of files) {
    await removeWhiteBackground(f);
  }
}

run();
