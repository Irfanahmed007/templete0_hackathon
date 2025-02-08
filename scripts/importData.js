import { createClient } from '@sanity/client';
import fetch from 'node-fetch';

// Initialize Sanity client with environment variables
const client = createClient({
  projectId: "1362q1tw", // Replace with your Sanity project ID
  dataset: process.env.SANITY_DATASET,     // Replace with your Sanity dataset name
  useCdn: true,                            // Set to true for faster reads
  apiVersion: '2025-01-13',                // Sanity API version
  token: process.env.SANITY_TOKEN,         // Replace with your Sanity token
});

// Function to upload an image to Sanity
async function uploadImageToSanity(imageUrl) {
  try {
    console.log(`Uploading image: ${imageUrl}`);

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${imageUrl} (Status: ${response.status})`);
    }

    const buffer = await response.arrayBuffer();
    const bufferImage = Buffer.from(buffer);

    const asset = await client.assets.upload('image', bufferImage, {
      filename: imageUrl.split('/').pop(),
    });

    console.log(`Image uploaded successfully: ${asset._id}`);
    return asset._id;
  } catch (error) {
    console.error(`Failed to upload image: ${imageUrl}. Error: ${error.message}`);
    return null;
  }
}

// Function to upload a single product to Sanity
async function uploadProduct(product) {
  try {
    if (!product || !product.imagePath || !product.name || !product.price) {
      console.warn('Skipping product due to missing required fields:', product);
      return;
    }

    const imageId = await uploadImageToSanity(product.imagePath);

    if (imageId) {
      const document = {
        _type: 'product',
        id: product.id,
        name: product.name,
        image: {
          _type: 'image',
          asset: {
            _ref: imageId,
          },
        },
        price: parseFloat(product.price), // Ensure the price is a number
        description: product.description || '',
        discountPercentage: product.discountPercentage || 0,
        isFeaturedProduct: !!product.isFeaturedProduct, // Ensure it's a boolean
        stockLevel: product.stockLevel || 0,
        category: product.category || 'Uncategorized',
      };

      const createdProduct = await client.create(document);
      console.log(`Product "${product.name}" uploaded successfully:`, createdProduct);
    } else {
      console.warn(`Product "${product.name}" skipped due to image upload failure.`);
    }
  } catch (error) {
    console.error(`Error uploading product "${product?.name}": ${error.message}`);
  }
}

// Function to fetch products from the provided API and upload them to Sanity
async function migrateProducts() {
  try {
    const apiUrl = 'https://template-0-beta.vercel.app/api/product';
    console.log(`Fetching products from API: ${apiUrl}`);

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch products. HTTP Status: ${response.status}`);
    }

    const products = await response.json();

    if (!Array.isArray(products)) {
      throw new Error('Invalid product data. Expected an array.');
    }

    console.log(`Fetched ${products.length} products. Starting migration...`);

    // Process products in parallel
    await Promise.all(products.map(uploadProduct));

    console.log('Product migration completed successfully!');
  } catch (error) {
    console.error('Error during product migration:', error.message);
  }
}

// Start the migration
migrateProducts();
