"""Sentence-transformer embedding helper.

We lazy-load the model so that:
  1. FastAPI startup never blocks on a HuggingFace network call. Top-level
     loading was crashing the server with "Cannot send a request, as the
     client has been closed." in recent huggingface_hub/httpx versions —
     and even a successful startup would have stalled boot by several
     seconds. Auth/login does not need embeddings, and a broken model
     fetch must not take down unrelated endpoints.
  2. Tests don't pay the model-load cost unless they actually touch
     embeddings (the SQLite fixture monkey-patches Vector to JSON anyway).

After the first call the model is cached at module scope. We also enable
`HF_HUB_OFFLINE=1` when the model is already in the local HF cache so the
loader doesn't hit the network at all on subsequent runs.
"""
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

_MODEL_NAME = "all-MiniLM-L6-v2"
_model = None


def _model_is_cached() -> bool:
    """True if the HF hub already has this model snapshot on disk."""
    cache_root = Path(
        os.getenv("HF_HOME", os.path.expanduser("~/.cache/huggingface"))
    ) / "hub"
    return (cache_root / f"models--sentence-transformers--{_MODEL_NAME}").is_dir()


def _get_model():
    global _model
    if _model is not None:
        return _model

    # If the model is already on disk, force the hub into offline mode so it
    # skips the network probe that was crashing on a closed httpx client.
    if _model_is_cached():
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
        os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

    from sentence_transformers import SentenceTransformer

    logger.info("Loading sentence-transformer model: %s", _MODEL_NAME)
    _model = SentenceTransformer(_MODEL_NAME)
    return _model


def generate_embedding(text: str):
    """Generates a 384-dimensional embedding for the given text."""
    if not text:
        return None
    embedding = _get_model().encode(text)
    return embedding.tolist()
