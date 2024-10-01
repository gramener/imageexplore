# Celebs with Korean origins

Source: <https://huggingface.co/datasets/ashraq/tmdb-celeb-10k/>

Extraction script:

```python
import pandas as pd

data = pd.read_parquet("celebs.parquet")
# Find all rows where 'biography' or 'place_of_birth' contains 'korea' - case insensitive
korea_data = data[data['biography'].str.contains('korea', case=False, na=False) | data['place_of_birth'].str.contains('korea', case=False, na=False)]

# For the first 100 rows by .popularity, save .image["bytes"] to the .name + ".jpg"
for index, row in korea_data.sort_values(by='popularity', ascending=False)[:100].iterrows():
    with open(row['name'] + ".jpg", "wb") as f:
        f.write(row['image']['bytes'])
```

After this, we manually deleted a few non-Korean celebrities like "Steve Buscemi", "James Earl Jones", "Wesley Snipes", and a name in Korean.
