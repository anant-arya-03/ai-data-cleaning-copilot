"""
models.py — All 3 models + text analysis utilities + smart auto-router
=======================================================================
Models:
  1. Misinformation Detector  (English)
  2. Fake News Classifier      (English, multi-class)
  3. EmoSen Sentiment          (Hinglish code-mix)

Text Analysis (rule-based, no ML):
  • Language detection
  • Script detection
  • Slang detection
  • Phoneme hints
  • Text stats

Smart Routing (NEW):
  • smart_predict()  — auto-routes a single text to the correct model
  • predict_batch()  — processes a list of texts (e.g. from a CSV)

Routing logic:
  code_mix_ratio > 0.15  OR  "Code-mix (Hinglish)" detected
      → predict_emosen()
  Otherwise
      → predict_misinfo() + predict_fakenews()

Usage:
    from models import load_models, predict_misinfo, predict_fakenews,
                       predict_emosen, analyse_text, smart_predict, predict_batch

    models = load_models()

    # Single text — auto-routed
    result = smart_predict("Yaar ye news sahi hai?", models)

    # Batch from CSV
    import pandas as pd
    df = pd.read_csv("your_data.csv")          # must have a 'text' column
    results = predict_batch(df["text"].tolist(), models)

    # Manual calls (unchanged)
    result = predict_misinfo("Some news text here", models)
    result = predict_fakenews("Some news text here", models)
    result = predict_emosen("Yaar ye bahut badhiya hai!", models)
    result = analyse_text("Any text")

Install:
    pip install torch transformers scikit-learn numpy pandas
"""

import os, re, warnings, unicodedata
import numpy as np
import torch
import torch.nn.functional as F
from collections import Counter
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from sklearn.preprocessing import LabelEncoder

warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────────
# EDIT THESE PATHS to match where your best_model folders live
# ─────────────────────────────────────────────────────────────
MISINFO_MODEL_DIR  = os.path.expanduser("~/misinfo_project/best_model")
FAKENEWS_MODEL_DIR = os.path.expanduser("~/fake_news_project/models/best_model")
EMOSEN_MODEL_DIR   = os.path.expanduser("~/emosen_project/models/best_model")

# ── Routing threshold (tune this if needed) ───────────────────
# Texts with code_mix_ratio above this go to EmoSen.
# Lower = catch more Hinglish. Higher = only route clearly Hinglish text.
CODEMIX_THRESHOLD = 0.15

# ── Label maps ────────────────────────────────────────────────
FAKENEWS_LABEL_MAP = {
    0: "true", 1: "mostly true", 2: "mix",
    3: "misleading", 4: "mostly fake", 5: "fake",
}
FAKENEWS_EMOJI = {
    "true": "✅", "mostly true": "🟡", "mix": "🔀",
    "misleading": "⚠️", "mostly fake": "🚨", "fake": "❌",
}
SENTIMENT_EMOJI = {
    "positive": "😊", "negative": "😠", "neutral": "😐",
}


# ═════════════════════════════════════════════════════════════
#  TEXT CLEANING
# ═════════════════════════════════════════════════════════════

def clean_news(text: str) -> str:
    text = str(text).lower()
    text = re.sub(r"http\S+|www\.\S+", "", text)
    text = re.sub(r"@\w+", "", text)
    text = re.sub(r"#(\w+)", r"\1", text)
    text = re.sub(r"rt\s+", "", text)
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def clean_tweet(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = text.lower()
    text = re.sub(r"http\S+", "", text)
    text = re.sub(r"@\w+", "", text)
    text = re.sub(r"(.)\1{2,}", r"\1\1", text)
    return text.strip()


# ═════════════════════════════════════════════════════════════
#  MODEL LOADING
# ═════════════════════════════════════════════════════════════

def load_models(
    misinfo_dir:  str = MISINFO_MODEL_DIR,
    fakenews_dir: str = FAKENEWS_MODEL_DIR,
    emosen_dir:   str = EMOSEN_MODEL_DIR,
) -> dict:
    """
    Load all 3 models into memory and return a dict.
    Call this once at startup and pass the result to predict_* functions.

    Returns:
        {
            "device": torch.device,
            "misinfo":  {"model": ..., "tokenizer": ...},
            "fakenews": {"model": ..., "tokenizer": ...},
            "emosen":   {"model": ..., "tokenizer": ..., "label_encoder": ...},
        }
    """
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    print(f"\n[1/3] Loading Misinfo model from {misinfo_dir} ...")
    try:
        misinfo_tokenizer = AutoTokenizer.from_pretrained(misinfo_dir)
        misinfo_model     = AutoModelForSequenceClassification.from_pretrained(misinfo_dir)
        misinfo_model.to(device).eval()
        print("  ✓ Misinfo model ready")
    except Exception as e:
        print(f"  ⚠ Failed to load Misinfo model: {e}")
        misinfo_model, misinfo_tokenizer = None, None

    print(f"\n[2/3] Loading Fake News model from {fakenews_dir} ...")
    try:
        fakenews_tokenizer = AutoTokenizer.from_pretrained(fakenews_dir)
        fakenews_model     = AutoModelForSequenceClassification.from_pretrained(fakenews_dir)
        fakenews_model.to(device).eval()
        print("  ✓ Fake News model ready")
    except Exception as e:
        print(f"  ⚠ Failed to load Fake News model: {e}")
        fakenews_model, fakenews_tokenizer = None, None

    print(f"\n[3/3] Loading EmoSen model from {emosen_dir} ...")
    try:
        emosen_tokenizer = AutoTokenizer.from_pretrained(emosen_dir)
        emosen_model     = AutoModelForSequenceClassification.from_pretrained(emosen_dir)
        emosen_model.to(device).eval()

        label_encoder = LabelEncoder()
        label_encoder.classes_ = np.load(
            os.path.join(emosen_dir, "label_classes.npy"), allow_pickle=True
        )
        print("  ✓ EmoSen model ready")
        print(f"  Sentiment classes: {list(label_encoder.classes_)}\n")
    except Exception as e:
        print(f"  ⚠ Failed to load EmoSen model: {e}")
        emosen_model, emosen_tokenizer, label_encoder = None, None, None

    return {
        "device":   device,
        "misinfo":  {"model": misinfo_model,  "tokenizer": misinfo_tokenizer},
        "fakenews": {"model": fakenews_model, "tokenizer": fakenews_tokenizer},
        "emosen":   {"model": emosen_model,   "tokenizer": emosen_tokenizer,
                     "label_encoder": label_encoder},
    }


# ═════════════════════════════════════════════════════════════
#  CORE INFERENCE
# ═════════════════════════════════════════════════════════════

@torch.no_grad()
def _infer(model, tokenizer, text: str, device, max_len: int = 256) -> np.ndarray:
    """Run a single forward pass and return softmax probabilities."""
    enc = tokenizer(
        text, truncation=True, padding="max_length",
        max_length=max_len, return_tensors="pt"
    )
    enc    = {k: v.to(device) for k, v in enc.items()}
    logits = model(**enc).logits
    probs  = F.softmax(logits, dim=1).cpu().numpy()[0]
    return probs


# ═════════════════════════════════════════════════════════════
#  PUBLIC PREDICTION FUNCTIONS
# ═════════════════════════════════════════════════════════════

def predict_misinfo(text: str, models: dict) -> dict:
    text = text.strip()
    if len(text.split()) < 3:
        return {"error": "Text too short. Please enter at least 3 words."}

    if models["misinfo"]["model"] is None:
        return {"error": "Model not loaded", "label": "unknown", "confidence": 0}

    cleaned = clean_news(text)
    probs   = _infer(
        models["misinfo"]["model"],
        models["misinfo"]["tokenizer"],
        cleaned,
        models["device"],
        max_len=256,
    )
    pred  = int(probs[1] > 0.5)
    label = "misinfo" if pred else "nonmisinfo"

    return {
        "label":           label,
        "confidence":      round(float(probs[pred]) * 100, 2),
        "prob_misinfo":    round(float(probs[1]) * 100, 2),
        "prob_nonmisinfo": round(float(probs[0]) * 100, 2),
        "text_analysis":   analyse_text(text),
    }


def predict_fakenews(text: str, models: dict) -> dict:
    text = text.strip()
    if len(text.split()) < 3:
        return {"error": "Text too short. Please enter at least 3 words."}

    if models["fakenews"]["model"] is None:
        return {"error": "Model not loaded", "label": "unknown", "confidence": 0, "all_scores": {}}

    cleaned  = clean_news(text)
    probs    = _infer(
        models["fakenews"]["model"],
        models["fakenews"]["tokenizer"],
        cleaned,
        models["device"],
        max_len=256,
    )
    pred_idx = int(np.argmax(probs))
    label    = FAKENEWS_LABEL_MAP.get(pred_idx, str(pred_idx))

    return {
        "label":      label,
        "emoji":      FAKENEWS_EMOJI.get(label, ""),
        "confidence": round(float(probs[pred_idx]) * 100, 2),
        "all_scores": {
            FAKENEWS_LABEL_MAP[i]: round(float(probs[i]) * 100, 2)
            for i in range(len(probs))
        },
        "text_analysis": analyse_text(text),
    }


def predict_emosen(text: str, models: dict) -> dict:
    text = text.strip()
    if len(text.split()) < 2:
        return {"error": "Text too short."}

    if models["emosen"]["model"] is None:
        return {"error": "Model not loaded", "label": "unknown", "confidence": 0, "all_scores": {}}

    le       = models["emosen"]["label_encoder"]
    cleaned  = clean_tweet(text)
    probs    = _infer(
        models["emosen"]["model"],
        models["emosen"]["tokenizer"],
        cleaned,
        models["device"],
        max_len=128,
    )
    pred_idx = int(np.argmax(probs))
    label    = le.inverse_transform([pred_idx])[0]

    return {
        "label":      label,
        "emoji":      SENTIMENT_EMOJI.get(label.lower(), "💬"),
        "confidence": round(float(probs[pred_idx]) * 100, 2),
        "all_scores": {
            le.classes_[i]: round(float(probs[i]) * 100, 2)
            for i in range(len(probs))
        },
        "text_analysis": analyse_text(text),
    }


def predict_all(text: str, models: dict) -> dict:
    text    = text.strip()
    results = {"text_analysis": analyse_text(text)}

    try:
        r = predict_misinfo(text, models)
        r.pop("text_analysis", None)
        results["misinfo"] = r
    except Exception as e:
        results["misinfo"] = {"error": str(e)}

    try:
        r = predict_fakenews(text, models)
        r.pop("text_analysis", None)
        results["fakenews"] = r
    except Exception as e:
        results["fakenews"] = {"error": str(e)}

    try:
        r = predict_emosen(text, models)
        r.pop("text_analysis", None)
        results["emosen"] = r
    except Exception as e:
        results["emosen"] = {"error": str(e)}

    return results


# ═════════════════════════════════════════════════════════════
#  SMART AUTO-ROUTER  (NEW)
# ═════════════════════════════════════════════════════════════

def smart_predict(text: str, models: dict, threshold: float = CODEMIX_THRESHOLD) -> dict:
    text     = text.strip()
    analysis = analyse_text(text)
    langs    = analysis["languages_detected"]
    ratio    = analysis["code_mix_ratio"]

    is_codemix = ratio > threshold or "Code-mix (Hinglish)" in langs

    if is_codemix:
        result = predict_emosen(text, models)
        result.pop("text_analysis", None)          # avoid duplication
        result["routed_to"]    = "emosen"
        result["text_analysis"] = analysis
    else:
        misinfo  = predict_misinfo(text, models)
        fakenews = predict_fakenews(text, models)
        misinfo.pop("text_analysis", None)         # avoid duplication
        fakenews.pop("text_analysis", None)
        result = {
            "routed_to":     "english",
            "misinfo":       misinfo,
            "fakenews":      fakenews,
            "text_analysis": analysis,
        }

    return result


def predict_batch(
    texts: list,
    models: dict,
    threshold: float = CODEMIX_THRESHOLD,
    verbose: bool = True,
) -> list:
    results = []
    total   = len(texts)

    for i, text in enumerate(texts, 1):
        if verbose and (i % 10 == 0 or i == 1 or i == total):
            print(f"  [{i}/{total}] Processing...")
        try:
            results.append(smart_predict(str(text), models, threshold=threshold))
        except Exception as e:
            results.append({"error": str(e), "routed_to": None, "input": text})

    return results


# ═════════════════════════════════════════════════════════════
#  TEXT ANALYSIS LAYER  (rule-based, no ML)
# ═════════════════════════════════════════════════════════════

INTERNET_SLANGS = {
    "lol","lmao","lmfao","rofl","omg","omfg","wtf","wth","tbh",
    "imo","imho","irl","fyi","brb","gtg","idk","idc","ngl","smh",
    "fomo","yolo","goat","lit","slay","vibe","lowkey","highkey",
    "periodt","bussin","no cap","cap","bet","sus","simp","salty",
    "ghosting","flex","drip","based","cringe","mid","rent free",
    "hits different","understood the assignment","it's giving",
    "main character","touch grass","ratio","w","l","fr","fr fr",
    "deadass","sheesh","bruh","bro","sis","bestie","snatched",
    "tea","spill the tea","clout","cancel","canceled","woke",
    "stan","ship","otp","npc","rizz","delulu","slay","era",
    "understood","valid","iconic","lewk","fit","fire","dope",
    "noob","pwned","gg","afk","dm","pm","tldr","tl;dr",
    "gonna","wanna","gotta","kinda","sorta","dunno","lemme",
    "gimme","ain't","y'all","tryna","finna","boutta","prolly",
}

HINGLISH_SLANGS = {
    "yaar","yarr","bhai","dost","mitra",
    "bakwaas","bakwas","sahi","sahi hai","bilkul","ekdum",
    "bindaas","mast","zabardast","badhiya","shandar",
    "paisa vasool","jhakkas","bekar","faltu","bekaar",
    "waah","wah","arre","arrey","achha","accha","acha",
    "theek hai","thik hai","kya baat","kya scene","scene",
    "jugaad","jugad","dhamaal","mazza","mazaa","maja",
    "chill","tension mat le","bas","khatam","lag raha",
    "lagta hai","shayad","pata nahi","bohot","bahut","zyada",
    "kuch nahi","sab theek","koi baat nahi","no tension",
    "pakka","pucca","ghanta","bakra","ullu","dimag mat kha",
    "pagal","paagal","diwana","diwani","pyaar","ishq","dil",
    "yaari","dosti","bindas","mast hai","epic","solid","set hai",
}

ABBREVIATIONS = {
    "u","r","ur","b4","4u","2day","2moro","2nite","tnite",
    "plz","pls","thx","thnx","ty","np","nw","ok","okk",
    "msg","msgs","asap","eta","btw","ftr","hbu","hmu","ily",
    "ilysm","jk","lmk","nbd","nsfw","ofc","omw","rn","tbf",
    "ttyl","tysm","wbu","wtv","xoxo","yw","bc","cuz","coz",
    "cos","nd","w/","w/o","b/w","vs",
}

HINDI_ROMAN_WORDS = {
    "hai","hain","hoon","ho","tha","thi","the","kya","kyun",
    "kaise","kaisa","kaisi","aur","ya","lekin","par","magar",
    "toh","to","se","ke","ka","ki","ko","ne","mein","pe",
    "ek","do","teen","char","paanch","chhe","saat","aath",
    "nau","das","sau","hazar","lakh","crore",
    "main","mujhe","mujhko","mera","meri","mere","hum","humara",
    "tumhara","tumhari","tumhare","tum","aap","aapka","aapki",
    "woh","wo","uska","uski","uske","unka","unki","unke",
    "yeh","ye","abhi","kal","aaj","parso","subah","shaam",
    "raat","din","ghar","khana","paani","chai","doodh","roti",
    "acha","achha","bura","theek","sahi","galat","naya","purana",
    "bada","chota","lamba","sundar","jao","aao","karo","dekho",
    "suno","bolo","ruko","chalo","nahi","nahin","mat","na",
    "haan","ji","bilkul","zaroor",
}

PHONEME_PATTERNS = [
    (r"\b\w*kh\w*",              "kh- (Hindi aspirated k)"),
    (r"\b\w*gh\w*",              "gh- (Hindi voiced velar)"),
    (r"\b\w*ch\w*",              "ch- (palatal affricate)"),
    (r"\b\w*jh\w*",              "jh- (Hindi aspirated j)"),
    (r"\b\w*sh\w*",              "sh- (palatal sibilant)"),
    (r"\b\w*th\w*",              "th- (dental/aspirated t)"),
    (r"\b\w*dh\w*",              "dh- (Hindi aspirated d)"),
    (r"\b\w*ph\w*",              "ph- (labial fricative)"),
    (r"\b\w*bh\w*",              "bh- (Hindi aspirated b)"),
    (r"\b\w*aa\b",               "-aa (long a vowel)"),
    (r"\b\w*ee\b",               "-ee (long i vowel)"),
    (r"\b\w*oo\b",               "-oo (long u vowel)"),
    (r"\b\w*wala\b",             "-wala (Hindi agent suffix)"),
    (r"\b\w*ing\b",              "-ing (English progressive)"),
    (r"\b\w*tion\b",             "-tion (English noun suffix)"),
    (r"\b\w*ly\b",               "-ly (English adverb suffix)"),
    (r"\bna\b",                  "na (Hindi negation)"),
    (r"\bnahi\b|\bnahin\b",      "nahi/nahin (Hindi negation)"),
    (r"\byaar\b|\byar\b",        "yaar (Hinglish address)"),
    (r"\b\w*ness\b",             "-ness (English noun suffix)"),
    (r"\b\w*ize\b|\b\w*ise\b",   "-ize/-ise (English verb suffix)"),
]


def detect_scripts(text: str) -> list:
    scripts   = set()
    has_roman = False
    for ch in text:
        cp = ord(ch)
        if   0x0900 <= cp <= 0x097F: scripts.add("Devanagari")
        elif 0x0600 <= cp <= 0x06FF: scripts.add("Arabic/Urdu")
        elif 0x0B80 <= cp <= 0x0BFF: scripts.add("Tamil")
        elif 0x0980 <= cp <= 0x09FF: scripts.add("Bengali")
        elif 0x0C00 <= cp <= 0x0C7F: scripts.add("Telugu")
        elif 0x0A00 <= cp <= 0x0A7F: scripts.add("Punjabi/Gurmukhi")
        elif 0x0D00 <= cp <= 0x0D7F: scripts.add("Malayalam")
        elif 0x0B00 <= cp <= 0x0B7F: scripts.add("Odia")
        elif 0x4E00 <= cp <= 0x9FFF: scripts.add("Chinese")
        elif 0x3040 <= cp <= 0x30FF: scripts.add("Japanese")
        elif 0xAC00 <= cp <= 0xD7AF: scripts.add("Korean")
        elif ch.isalpha() and ch.isascii(): has_roman = True
    if has_roman: scripts.add("Roman")
    if not scripts: scripts.add("Unknown")
    return sorted(scripts)


def detect_languages(tokens: list, scripts: list) -> list:
    langs = set()
    hindi_count   = sum(1 for t in tokens if t in HINDI_ROMAN_WORDS)
    english_count = sum(1 for t in tokens
                        if t.isalpha() and t not in HINDI_ROMAN_WORDS
                        and t not in HINGLISH_SLANGS)
    total = max(len(tokens), 1)

    script_lang_map = {
        "Devanagari":       "Hindi (Devanagari)",
        "Arabic/Urdu":      "Urdu/Arabic",
        "Tamil":            "Tamil",
        "Bengali":          "Bengali",
        "Telugu":           "Telugu",
        "Punjabi/Gurmukhi": "Punjabi",
        "Malayalam":        "Malayalam",
        "Odia":             "Odia",
        "Chinese":          "Chinese",
        "Japanese":         "Japanese",
        "Korean":           "Korean",
    }
    for script, lang in script_lang_map.items():
        if script in scripts:
            langs.add(lang)

    if "Roman" in scripts:
        if hindi_count / total > 0.3:   langs.add("Hindi (Roman)")
        if english_count / total > 0.3: langs.add("English")
        if hindi_count > 0 and english_count > 0:
            langs.add("Code-mix (Hinglish)")

    if not langs:
        langs.add("English")
    return sorted(langs)


def detect_slangs(raw_text: str, tokens: list) -> dict:
    found_internet = []
    found_hinglish = []
    found_abbrevs  = []
    raw_lower = raw_text.lower()

    for t in tokens:
        if t in INTERNET_SLANGS:  found_internet.append(t)
        if t in HINGLISH_SLANGS:  found_hinglish.append(t)
        if t in ABBREVIATIONS:    found_abbrevs.append(t)

    for phrase in INTERNET_SLANGS:
        if " " in phrase and phrase in raw_lower:
            if phrase not in found_internet:
                found_internet.append(phrase)

    stretched     = list(set(re.findall(r"\b\w*(.)\1{2,}\w*\b", raw_lower)))
    emojis_found  = list(set(
        ch for ch in raw_text
        if unicodedata.category(ch) in ("So", "Sm", "Sk")
        or (ord(ch) > 0x1F300 and not ch.isalnum())
    ))[:20]

    return {
        "internet_slang":  sorted(set(found_internet)),
        "hinglish_slang":  sorted(set(found_hinglish)),
        "abbreviations":   sorted(set(found_abbrevs)),
        "stretched_words": stretched,
        "emojis_present":  emojis_found,
        "slang_count":     len(set(found_internet) | set(found_hinglish) | set(found_abbrevs)),
    }


def detect_phonemes(text: str) -> list:
    text_lower = text.lower()
    found, seen = [], set()
    for pattern, label in PHONEME_PATTERNS:
        matches = re.findall(pattern, text_lower)
        if matches and label not in seen:
            found.append({
                "pattern":  label,
                "examples": list(set(
                    m if isinstance(m, str) else m[0] for m in matches
                ))[:3],
            })
            seen.add(label)
    return found


def text_stats(text: str) -> dict:
    words        = text.split()
    word_lengths = [len(w) for w in words] if words else [0]
    sentences    = [s for s in re.split(r"[.!?।]+", text.strip()) if s.strip()]
    return {
        "char_count":      len(text),
        "word_count":      len(words),
        "sentence_count":  max(len(sentences), 1),
        "avg_word_length": round(sum(word_lengths) / max(len(word_lengths), 1), 2),
        "hashtags":        re.findall(r"#\w+", text),
        "mentions":        re.findall(r"@\w+", text),
        "urls_present":    bool(re.search(r"http\S+|www\.\S+", text)),
        "has_numbers":     bool(re.search(r"\d", text)),
        "uppercase_ratio": round(
            sum(1 for c in text if c.isupper()) / max(len(text), 1), 3
        ),
    }


def analyse_text(raw_text: str) -> dict:
    """Full rule-based text analysis — no ML involved."""
    tokens  = re.findall(r"\b\w+\b", raw_text.lower())
    scripts = detect_scripts(raw_text)
    langs   = detect_languages(tokens, scripts)
    slangs  = detect_slangs(raw_text, tokens)
    phones  = detect_phonemes(raw_text)
    stats   = text_stats(raw_text)

    roman_tokens   = [t for t in tokens if t.isascii()]
    hindi_roman    = [t for t in roman_tokens if t in HINDI_ROMAN_WORDS]
    code_mix_ratio = round(len(hindi_roman) / max(len(roman_tokens), 1), 3)

    return {
        "scripts_detected":   scripts,
        "languages_detected": langs,
        "code_mix_ratio":     code_mix_ratio,
        "slang_analysis":     slangs,
        "phoneme_hints":      phones,
        "text_stats":         stats,
    }
