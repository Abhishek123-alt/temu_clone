from sentence_transformers import SentenceTransformer
import numpy as np

# Load the model once
model = SentenceTransformer('all-MiniLM-L6-v2')

def generate_embedding(text: str):
    """Generates a 384-dimensional embedding for the given text."""
    if not text:
        return None
    embedding = model.encode(text)
    return embedding.tolist()
