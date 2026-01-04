import asyncio
import argparse
import os
import sys
from perchance import ImageGenerator

# This script is called by the Node.js WhatsApp bot to generate images using Perchance
# It uses the perchance library which automates the browser via Playwright

async def generate_image(prompt, out_path, shape):
    try:
        # Initialize the ImageGenerator
        async with ImageGenerator() as gen:
            print(f"Generating image for prompt: {prompt} with shape: {shape}")
            
            # Generate the image
            result = await gen.image(prompt, shape=shape)
            
            # Download the image binary data
            binary = await result.download()
            
            # Save the binary data to the specified output path
            with open(out_path, "wb") as f:
                f.write(binary.getbuffer())
            
            # Print success message for the Node.js parent process to capture
            print(f"SUCCESS: {out_path}")
            
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Generate image using Perchance")
    parser.add_validator = False # Disable default behavior for some environments
    parser.add_argument("--prompt", required=True, help="The prompt for image generation")
    parser.add_argument("--out", required=True, help="The output path for the image")
    parser.add_argument("--shape", default="square", choices=["square", "portrait", "landscape"], help="The shape of the image")
    
    args = parser.parse_args()
    
    # Run the async generation function
    asyncio.run(generate_image(args.prompt, args.out, args.shape))
