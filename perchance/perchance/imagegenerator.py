from __future__ import annotations

import base64
import io
import random
from typing import Literal

import aiofiles

from . import errors
from .generator import Generator


class ImageResult:
    """Image generation result."""

    def __init__(
        self, 
        *, 
        generator: ImageGenerator,
        image_id: str,
        file_extension: str,
        seed: int,
        prompt: str,
        width: int,
        height: int,
        guidance_scale: float,
        negative_prompt: str | None,
        maybe_nsfw: bool
    ) -> None:
        self._generator: ImageGenerator = generator

        self.image_id: str = image_id
        """Image ID."""
        self.file_extension: str = file_extension
        """File extension."""
        self.seed: int = seed
        """Generation seed."""
        self.prompt: str = prompt
        """Image prompt."""
        self.width: int = width
        """Image width."""
        self.height: int = height
        """Image height."""
        self.guidance_scale: float = guidance_scale
        """Guidance scale."""
        self.negative_prompt: str | None = negative_prompt
        """Negative prompt."""
        self.maybe_nsfw: bool = maybe_nsfw
        """Whether the image may be NSFW."""
    
    def __str__(self) -> str:
        return f"{self.image_id}.{self.file_extension}"

    @property
    def size(self) -> tuple[int, int]:
        """Image size as (width, height)."""
        return self.width, self.height

    async def download(self) -> io.BytesIO:
        """Download the image."""
        url = (
            f"{self._generator.BASE_URL}/downloadTemporaryImage"
            f"?imageId={self.image_id}"
        )

        async with await self._generator._context.new_page() as page:
            await page.goto(
                f"{self._generator.BASE_URL}/verifyUser"
                f"?thread=0"
                f"&__cacheBust={random.random()}"
            )
            
            response_data = await page.evaluate("""
                async (url) => {
                    const response = await fetch(url);
                    if (!response.ok) {
                        return { ok: false, status: response.status };
                    }

                    const blob = await response.blob();

                    const base64 = await new Promise(resolve => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            resolve(reader.result.split(",")[1]);
                        };
                        reader.readAsDataURL(blob);
                    });

                    return { ok: true, data: base64 };
                }
                """, url)
                            
            if not response_data['ok']:
                raise errors.ConnectionError(
                    f"Failed to download image: {response_data['status']}"
                )
            
            data = base64.b64decode(response_data['data'])
            return io.BytesIO(data)
 
    async def save(self, filename: str | None = None) -> None:
        """Download and save the image.

        Parameters
        ----------
        filename: str | None
            Name of the output file.
        """
        file = filename or f"{self.image_id}.{self.file_ext}" 

        async with aiofiles.open(file, 'wb') as f:
            img = await self.download()
            await f.write(img.read())
            

class ImageGenerator(Generator):
    """AI image generator"""

    BASE_URL = "https://image-generation.perchance.org/api"

    def __init__(self) -> None:
        super().__init__()

    async def image(
        self,
        prompt: str,
        *,
        negative_prompt: str | None = None,
        seed: int = -1,
        shape: Literal['portrait', 'square', 'landscape'] = 'square',
        guidance_scale: float = 7.0
    ) -> ImageResult:
        """
        Generate image.

        Parameters
        ----------
        prompt: str
            Image description.
        negative_prompt: str | None
            Things you do NOT want to see in the image.
        seed: int
            Generation seed.
        shape: str
            Image shape. Can be either `portrait`, `square` or `landscape`.
        guidance_scale: float
            Accuracy of the prompt in range `1-30`. 
        """
        if shape == 'portrait':
            resolution = '512x768'
        elif shape == 'square':
            resolution = '768x768'
        elif shape == 'landscape':
            resolution = '768x512'
        else:
            raise ValueError(f"Invalid shape: {shape}")
      
        await self._start()

        async with await self._context.new_page() as page:
            await page.goto(
                f"{self.BASE_URL}/verifyUser"
                f"?thread=0"
                f"&__cacheBust={random.random()}"
            )

            content = await page.content()

            key_entry = content.find('"userKey":"')
            start_index = key_entry + len('"userKey":"')
            end_index = content.find('"', start_index)

            if key_entry == -1 or end_index == -1:
                if "too_many_requests" in content:
                    raise errors.RateLimitError("Rate limit exceeded")
                else:
                    raise errors.AuthenticationError("Failed to retrieve user key")

            key = content[start_index:end_index]

            url = (
                f"{self.BASE_URL}/generate"
                f"?userKey={key}"
                f"&requestId=aiImageCompletion{random.randint(0, 2**30)}"
                f"&__cacheBust={random.random()}"
            )
            body = {
                "generatorName": "ai-image-generator",
                "channel": "ai-text-to-image-generator",
                "subChannel": "public",
                "prompt": prompt,
                "negativePrompt": negative_prompt or "",
                "seed": seed,
                "resolution": resolution,
                "guidanceScale": guidance_scale
            }
      
            response = await page.evaluate("""
                async ({ url, body }) => {
                    const controller = new AbortController();
                    window.abortFetch = () => controller.abort();

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                        signal: controller.signal
                    });
                                
                    return await response.json();
                }
            """, {"url": url, "body": body})

            return ImageResult(
                generator=self,
                image_id=response['imageId'],
                file_extension=response['fileExtension'],
                seed=response['seed'],
                prompt=response['prompt'],
                width=response['width'],
                height=response['height'],
                guidance_scale=response['guidanceScale'],
                negative_prompt=response['negativePrompt'],
                maybe_nsfw=response['maybeNsfw']
            )
                        