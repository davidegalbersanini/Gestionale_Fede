import json
with open("src/data/initialData.json", encoding="utf-8") as f:
    d = json.load(f)

w_names = [w["bride_name"] for w in d["weddings"]]
print(f"Total weddings in initialData: {len(w_names)}")
print("Last 5 wedding names:")
for n in w_names[-5:]:
    print(" ", n)

