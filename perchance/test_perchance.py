import asyncio
from perchance import TextGenerator

async def main():
    try:
        async with TextGenerator() as gen:
            prompt = "Hello, how are you?"
            print(f"Testing text generation with prompt: {prompt}")
            response = await gen.t2t(prompt)
            print(f"Response: {response}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
