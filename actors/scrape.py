import os
import re
import requests
import unicodedata
from tqdm import tqdm


def unicode_to_slug(s):
    return re.sub(
        r"[^a-z0-9]+",
        "-",
        unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii").lower(),
    ).strip("-")


# Fetch the top 100 most popular people
def fetch_popular_people(api_key, pages=5):
    people = []
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    for page in tqdm(range(1, pages + 1)):
        response = requests.get(
            "https://api.themoviedb.org/3/person/popular",
            params={"page": page},
            headers=headers,
            timeout=10,
        )
        response.raise_for_status()
        people.extend(response.json()["results"])
    return people


# Save profile pictures
def save_people_data(people):
    for person in tqdm(people):
        profile_path = person.get("profile_path")
        img_filename = f"{unicode_to_slug(person['name'])}.jpg"
        if profile_path and not os.path.exists(img_filename):
            img_data = requests.get(
                f"https://image.tmdb.org/t/p/w500{profile_path}", timeout=10
            ).content
            with open(img_filename, "wb") as img_file:
                img_file.write(img_data)


if __name__ == "__main__":
    people = fetch_popular_people(os.environ.get("TMDB_API_KEY"))
    save_people_data(people)
