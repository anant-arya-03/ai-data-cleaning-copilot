import re

def is_code(text: str) -> bool:
    code_keywords = ["def ", "class ", "import ", "print(", "return ", "if ", "else:", "for ", "while "]
    code_chars = ["{", "}", "()", "[]", "=>", "==", "!=", "++", "--"]

    keyword_matches = sum(1 for kw in code_keywords if kw in text)
    char_matches = sum(1 for char in code_chars if char in text)

    return (keyword_matches + char_matches) >= 2

def is_noisy(text: str) -> bool:
    noisy_chars = ["@", "#", "$", "%", "^", "&", "*", "~", "`", "|", "\\"]
    count = sum(1 for char in text if char in noisy_chars)
    # Consider noisy if more than 5 special characters, or a high ratio
    return count > 5 or (len(text) > 0 and count / len(text) > 0.1)

def route_text(text: str) -> str:
    """
    Stage 1: Rule-based routing
    Stage 2: ML-based lightweight classifier (simulated with keyword scoring)
    """
    # Stage 1: Rule-based
    if is_code(text):
        return "MODEL_1"

    if is_noisy(text):
        return "MODEL_3"

    # Stage 2: Lightweight classifier logic
    # In a real scenario, this could be a scikit-learn model or a simple fasttext model.
    # Here we simulate it with some scoring logic.
    tech_words = ["algorithm", "data", "system", "network", "server", "database"]
    casual_words = ["hello", "how", "what", "good", "bad", "yes", "no"]

    text_lower = text.lower()
    tech_score = sum(1 for w in tech_words if w in text_lower)
    casual_score = sum(1 for w in casual_words if w in text_lower)

    if tech_score > casual_score:
        return "MODEL_1"
    elif casual_score > tech_score:
        return "MODEL_2"
    else:
        # Default to safe model
        return "MODEL_2"
