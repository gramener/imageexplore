# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "httpx",
#     "tqdm",
# ]
# ///

import base64
import glob
import httpx
import json
import os
from tqdm import tqdm

token = os.environ["LLMFOUNDRY_TOKEN"]


def add_embeddings(path: str):
    target = os.path.join(os.path.dirname(path), "embeddings.json")
    if os.path.exists(target):
        return
    with open(path, "r") as f:
        data = json.load(f)
    embeddings = []
    for doc in tqdm(data["docs"], desc=path):
        instance = {}
        is_image = doc["type"] == "image"
        if is_image:
            image_path = os.path.join(os.path.dirname(path), doc["name"])
            # Read the image as base64
            with open(image_path, "rb") as f:
                image_data = base64.b64encode(f.read()).decode("utf-8")
            instance["image"] = {"bytesBase64Encoded": image_data}
        else:
            instance["text"] = doc["name"]
        response = httpx.post(
            "https://llmfoundry.straive.com/vertexai/google/models/multimodalembedding@001:predict",
            json={"instances": [instance]},
            headers={"Authorization": f"Bearer {token}:imageexplore-embeddings"},
            timeout=100,
        )
        val = response.json()["predictions"][0]
        embeddings.append(val["imageEmbedding"] if is_image else val["textEmbedding"])
    with open(target, "w") as f:
        json.dump({"embeddings": embeddings}, f, separators=(",", ":"))


if __name__ == "__main__":
    for path in glob.glob("**/similarity.json", recursive=True):
        add_embeddings(path)
