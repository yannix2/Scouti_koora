"""
Similarity Service — port 8002
Owns: KNN model + feature matrix — /similar/{name}
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pickle, json, pandas as pd, numpy as np
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / "data" / "processed"
MODELS = PROCESSED

app = FastAPI(title="Similarity Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

player_index: pd.DataFrame = pd.DataFrame()
X_scaled: np.ndarray = np.array([])
knn_model = None
knn_features: list = []


@app.on_event("startup")
def load_models():
    global player_index, X_scaled, knn_model, knn_features

    player_index = pd.read_csv(PROCESSED / "player_index.csv")
    feat_matrix = pd.read_csv(PROCESSED / "feature_matrix_scaled.csv")
    feat_matrix = feat_matrix.select_dtypes(include=["number"])
    X_scaled = feat_matrix.values

    with open(MODELS / "knn_similarity_model.pkl", "rb") as f:
        knn_model = pickle.load(f)
    with open(MODELS / "similarity_features.pkl", "rb") as f:
        knn_features = pickle.load(f)


def norm(name):
    if not name: return ""
    n = unicodedata.normalize("NFD", str(name))
    n = "".join(c for c in n if unicodedata.category(c) != "Mn")
    return n.lower().strip()


@app.get("/health")
def health():
    return {"status": "ok", "players": len(player_index)}


@app.get("/similar/{player_name}")
def similar_players(player_name: str, top_n: int = 10, same_position: bool = True):
    ref = player_index[player_index["Player"].apply(norm) == norm(player_name)]
    if ref.empty:
        ref = player_index[player_index["Player"].apply(norm).str.contains(norm(player_name), na=False)]
    if ref.empty:
        raise HTTPException(status_code=404, detail=f"Player not found: {player_name}")

    ridx = ref.index[0]
    query_vec = pd.DataFrame(X_scaled[ridx:ridx + 1], columns=knn_features)
    dists, idxs = knn_model.kneighbors(query_vec, n_neighbors=min(top_n + 20, len(X_scaled)))
    ref_pos = player_index.iloc[ridx].get("primary_pos", "")
    results = []
    for dist, idx in zip(dists[0], idxs[0]):
        if idx == ridx:
            continue
        row = player_index.iloc[idx]
        if same_position and row.get("primary_pos") != ref_pos:
            continue
        results.append({
            "Player": row["Player"],
            "similarity_pct": round((1 - dist) * 100, 1),
            "primary_pos": row.get("primary_pos", ""),
            "Squad": row.get("Squad", ""),
            "league": row.get("league", ""),
            "season": row.get("season", ""),
        })
        if len(results) >= top_n:
            break
    return results


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
