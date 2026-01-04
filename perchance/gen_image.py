import asyncio
import sys
import os
import argparse
from perchance import ImageGenerator

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt", required=True, help="Prompt for image generation")
    parser.add_argument("--out", required=True, help="Output file path")
    parser.add_argument("--shape", default="square", choices=["portrait", "square", "landscape"], help="Image shape")
    args = parser.parse_args()

    try:
        async with ImageGenerator() as gen:
            # Generate the image
            result = await gen.image(
                prompt=args.prompt,
                shape=args.shape
            )
            
            # Download the image
            binary = await result.download()
            
            # Save to file
            with open(args.out, "wb") as f:
                f.write(binary.getbuffer())
            
            print(f"SUCCESS:{args.out}")
    except Exception as e:
        print(f"ERROR:{str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
