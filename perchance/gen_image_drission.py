import argparse
import sys
import time
import random
import base64
from DrissionPage import ChromiumPage, ChromiumOptions

import shutil
import tempfile
import os

def generate_image(prompt, out_path, shape):
    user_data_dir = tempfile.mkdtemp()
    page = None
    try:
        co = ChromiumOptions()
        # co.auto_port() # Buggy in some versions
        
        # Manually find free port
        import socket
        sock = socket.socket()
        sock.bind(('', 0))
        port = sock.getsockname()[1]
        sock.close()
        
        co.set_local_port(port)
        co.set_user_data_path(user_data_dir) # Complete isolation
        
        co.headless(True) 
        co.set_argument('--no-sandbox')
        co.set_argument('--disable-dev-shm-usage')
        co.set_argument('--disable-gpu')
        co.set_argument('--mute-audio')
        co.set_argument('--disable-extensions') 
        co.set_argument('--disable-plugins') 
        co.set_argument('--start-maximized') 
        
        # Block common ad/tracker domains to speed up loading
        # co.set_argument('--host-rules="MAP *google-analytics.com 127.0.0.1, MAP *doubleclick.net 127.0.0.1"') 
        
        page = ChromiumPage(co)
        
        # print("Navigating to Perchance Wrapper...")
        page.get("https://perchance.org/ai-text-to-image-generator")
        
        # Fast Cloudflare check
        for _ in range(10):
            if "Just a moment" in page.title or "Cloudflare" in page.title:
                time.sleep(1)
            else:
                break
        
        # print("Finding generator (searching iframes)...")
        target = None
        
        # Fast iframe search
        for _ in range(5):
            frames = page.get_frames()
            for f in frames:
                try:
                    # Check for the specific button ID the user provided
                    if f.ele('#generateButtonEl'):
                        # print(f"Found generator in iframe: {f.attrs.get('src', 'unknown')[:50]}...")
                        target = f
                        break
                except:
                    continue
            if target:
                break
            time.sleep(1)
            
        if not target:
            # Fallback to main page check
            if page.ele('#generateButtonEl'):
                # print("Found generator in main page!")
                target = page
            else:
                print("ERROR: Generator elements not found (textarea/button).")
                # page.get_screenshot(path="debug_not_found.png")
                page.quit()
                sys.exit(1)
            
        # Try to navigate directly to the iframe to bypass wrapper overhead if not already there
        # DISABLED: Direct navigation might be breaking the session/context
        # if target != page:
        #    iframe_src = target.attrs.get('src')
        #    if iframe_src and 'perchance.org' in iframe_src:
        #        print(f"Navigating directly to generator for speed...")
        #        page.get(iframe_src)
        #        target = page
        #        time.sleep(1)
            
        # print("Generator ready.")
        
        # Set the prompt using native DrissionPage methods for better event triggering
        # print("Setting prompt...")
        try:
            # Find the textarea specifically
            tx = target.ele('css:textarea[data-name="description"]')
            if not tx:
                tx = target.ele('css:textarea.paragraph-input')
            if not tx:
                tx = target.ele('tag:textarea')
                
            if tx:
                # Clear and type naturally (triggers all events: focus, input, change, blur)
                tx.clear()
                tx.input(prompt)
                # Ensure it's set by force just in case
                if tx.value != prompt:
                     target.run_js(f"arguments[0].value = `{prompt}`;", tx)
                     target.run_js("arguments[0].dispatchEvent(new Event('input', { bubbles: true }));", tx)
            else:
                print("Warning: Input textarea not found!")
        except Exception as e:
            print(f"Error setting prompt: {e}")
            
        # print("Prompt set.")
        
        # Speed up: set "How many?" to 1
        # print("Optimizing settings (How many = 1)...")
        target.run_js("""
            var selects = document.querySelectorAll('select');
            for(var s of selects) {
                if(s.innerText.includes('How many') || s.id.includes('count')) {
                    s.value = "1";
                    s.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        """)
        
        # Start listening BEFORE clicking
        # print("Waiting for generation (listening for all requests)...")
        page.listen.start()
        
        # Click generate button
        # print("Clicking generate...")
        # Use native wait to ensure button is loaded (timeout 10s)
        btn = target.ele('#generateButtonEl', timeout=10)
        if not btn:
            # print("Button not found by ID, trying text match...")
            btn = target.ele('text:generate', timeout=5)
            if not btn:
                # print("Trying exact text match...")
                btn = target.ele('text=✨ generate', timeout=2)

        if btn:
            # print("Found generate button.")
            # Scroll to view to ensure no obstruction
            target.run_js("arguments[0].scrollIntoView(true);", btn)
            time.sleep(0.5)
            # Try native click first (better for trusted events)
            try:
                btn.hover()
                btn.click()
            except:
                # Fallback to JS click
                target.run_js("arguments[0].click();", btn)
            
            clicked = "SUCCESS_ID"
            time.sleep(2)
            # Save HTML for debugging
            # with open("debug_after_click.html", "w", encoding="utf-8") as f:
            #    f.write(target.html)
        else:
            clicked = "NOT_FOUND"
            
        # print(f"Click status: {clicked}")
        
        # Now wait for the packet
        image_id = None
        start_time = time.time()
        print("Waiting for generation...")
        while time.time() - start_time < 60:
            # Check for packets
            res = page.listen.wait(timeout=0.5)
            if res:
                url = res.url
                # Debug: print all relevant api calls
                # if 'perchance' in url or 'api' in url:
                # print(f"DEBUG URL: {url}")

                if 'api/generate' in url or 'generate' in url or 'verifyUser' in url:
                    # print(f"Captured request: {url}")
                    body = res.response.body
                    if body:
                        if isinstance(body, bytes):
                             body = body.decode('utf-8', errors='ignore')
                        
                        # Debug print body start
                        # print(f"Body: {body[:100]}")

                        import json, re
                        try:
                            data = json.loads(body)
                            image_id = data.get('imageId') or (data.get('imageIds') and data.get('imageIds')[0])
                        except:
                            pass
                            
                        if not image_id:
                            match = re.search(r'"imageId"\s*:\s*"([^"]+)"', body)
                            if match: image_id = match.group(1)
                            
                        if image_id:
                            # print(f"SUCCESS: Found Image ID via network: {image_id}")
                            break
            
            # Check DOM as fallback
            try:
                # Debug: Print found images every 5 seconds
                # if int(time.time()) % 5 == 0:
                if True: # Always check nested frames
                    imgs = target.eles('tag:img')
                    # print(f"Debug: Found {len(imgs)} images in DOM")
                    
                    # Check for nested iframes
                    frames = target.eles('tag:iframe')
                    if frames:
                        # print(f"Debug: Found {len(frames)} nested iframes")
                        for nf in frames:
                            # print(f"  Nested iframe src: {nf.attrs.get('src')}")
                            # Try to look inside nested iframe
                            try:
                                # Look for the specific result image ID provided by user
                                img_el = nf.ele('#resultImgEl')
                                if img_el:
                                    src = img_el.attrs.get('src')
                                    # print(f"SUCCESS: Found result image in nested iframe: {src[:50]}...")
                                    
                                    # Download logic
                                    # If src is relative or absolute URL, we can fetch it
                                    # If it's blob, we must fetch it inside the frame context
                                    
                                    print(f"Downloading image data...")
                                    base64_data = nf.run_js(f"""
                                       var img = document.querySelector('#resultImgEl');
                                       if (!img) return null;
                                       var src = img.src;
                                       return fetch(src).then(r => r.blob()).then(blob => {{
                                           return new Promise((resolve, reject) => {{
                                               var reader = new FileReader();
                                               reader.onloadend = () => resolve(reader.result);
                                               reader.onerror = reject;
                                               reader.readAsDataURL(blob);
                                           }});
                                       }}).catch(e => null);
                                    """)
                                    
                                    if base64_data:
                                        if "," in base64_data:
                                           base64_data = base64_data.split(",")[1]
                                           
                                        with open(out_path, "wb") as f:
                                           f.write(base64.b64decode(base64_data))
                                           
                                        print(f"SUCCESS: {out_path}")
                                        try:
                                            if page: page.quit()
                                        except: pass
                                        sys.exit(0)
                                        
                            except Exception as e:
                                # print(f"  Error checking nested iframe: {e}")
                                pass

                    for i, img in enumerate(imgs):
                        src = img.attrs.get('src', 'No src')
                        # print(f"  Img {i}: {src[:100]}...") 
                        
                        if 'imageId=' in src:
                            import re
                            match = re.search(r'imageId=([^&]+)', src)
                            if match:
                                image_id = match.group(1)
                                print(f"SUCCESS: Found Image ID via DOM: {image_id}")
                                break
                
                if image_id: break
            except Exception as e:
                print(f"DOM Check Error: {e}")
                pass
                
            time.sleep(0.5)
            
        if not image_id:
            print("ERROR: Generation failed or timed out.")
            page.get_screenshot(path="debug_error.png")
            # Dump HTML at failure time
            with open("debug_fail.html", "w", encoding="utf-8") as f:
                f.write(target.html)
            page.quit()
            sys.exit(1)
            
        download_url = f"https://image-generation.perchance.org/api/downloadTemporaryImage?imageId={image_id}"
        print(f"Downloading from {download_url}...")
        
        base64_data = page.run_js(f"""
            return fetch("{download_url}").then(r => r.blob()).then(blob => {{
                return new Promise((resolve, reject) => {{
                    var reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                }});
            }});
        """)
        
        if not base64_data:
            print("ERROR: Failed to download image data")
            page.quit()
            sys.exit(1)
            
        if "," in base64_data:
            base64_data = base64_data.split(",")[1]
            
        with open(out_path, "wb") as f:
            f.write(base64.b64decode(base64_data))
            
        print(f"SUCCESS: {out_path}")
        page.quit()

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"ERROR: {str(e)}")
        try:
            if page: page.quit()
        except:
            pass
        sys.exit(1)
    finally:
        # Cleanup temp user data
        try:
            shutil.rmtree(user_data_dir, ignore_errors=True)
        except:
            pass

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--shape", default="square")
    args = parser.parse_args()
    
    generate_image(args.prompt, args.out, args.shape)
