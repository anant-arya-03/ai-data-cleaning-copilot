"""
unified_api.py — Single Flask API for all 3 models + text analysis layer
=========================================================================
Models (UNCHANGED — no parameter modifications):
  1. Misinformation Detector  (English)
  2. Fake News Classifier      (English, multi-class)
  3. EmoSen Sentiment          (Hinglish code-mix)

Extra analysis added on TOP of every response (no model changes):
  • Language detection     — which language(s) are present
  • Script detection       — Devanagari / Roman / Arabic / mixed
  • Slang detection        — internet slang, Hinglish slang, abbreviations
  • Phoneme hints          — common sound patterns in the text
  • Text stats             — word count, avg word length, char count

Install:
    pip install flask flask-cors torch transformers scikit-learn numpy

Run:
    python unified_api.py
"""

import os, re, warnings, unicodedata
import numpy as np
import torch
import torch.nn.functional as F
from collections import Counter
from flask import Flask, jsonify, request
from flask_cors import CORS
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from sklearn.preprocessing import LabelEncoder

warnings.filterwarnings("ignore")

app  = Flask(__name__)
CORS(app)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Device: {device}")

# ─────────────────────────────────────────────────────────────
# EDIT THESE PATHS to match where your best_model folders live
# ─────────────────────────────────────────────────────────────
MISINFO_MODEL_DIR  = os.path.expanduser("~/misinfo_project/best_model")
FAKENEWS_MODEL_DIR = os.path.expanduser("~/fake_news_project/models/best_model")
EMOSEN_MODEL_DIR   = os.path.expanduser("~/emosen_project/models/best_model")

# ── Fake News label map ───────────────────────────────────────
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
#  TEXT ANALYSIS LAYER  (pure rule-based, no model changes)
# ═════════════════════════════════════════════════════════════

# ── Internet / English slang dictionary ──────────────────────
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

# ── Hinglish / Indian slang dictionary ───────────────────────
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

# ── Common abbreviations ──────────────────────────────────────
ABBREVIATIONS = {
    "u","r","ur","b4","4u","2day","2moro","2nite","tnite",
    "plz","pls","thx","thnx","ty","np","nw","ok","okk",
    "msg","msgs","asap","eta","btw","ftr","hbu","hmu","ily",
    "ilysm","jk","lmk","nbd","nsfw","ofc","omw","rn","tbf",
    "ttyl","tysm","wbu","wtv","xoxo","yw","bc","cuz","coz",
    "cos","nd","w/","w/o","b/w","vs",
}

# ── Hindi Roman word markers ──────────────────────────────────
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

# ── Script detection via Unicode ranges ──────────────────────
def detect_scripts(text):
    scripts = set()
    has_roman = False
    for ch in text:
        cp = ord(ch)
        if 0x0900 <= cp <= 0x097F: scripts.add("Devanagari")
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


# ── Language detection (rule-based) ──────────────────────────
def detect_languages(tokens, scripts):
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
        hindi_ratio   = hindi_count / total
        english_ratio = english_count / total
        if hindi_ratio > 0.3:
            langs.add("Hindi (Roman)")
        if english_ratio > 0.3:
            langs.add("English")
        if hindi_count > 0 and english_count > 0:
            langs.add("Code-mix (Hinglish)")

    if not langs:
        langs.add("English")
    return sorted(langs)


# ── Slang detection ───────────────────────────────────────────
def detect_slangs(raw_text, tokens):
    found_internet = []
    found_hinglish = []
    found_abbrevs  = []
    raw_lower = raw_text.lower()

    for t in tokens:
        if t in INTERNET_SLANGS:  found_internet.append(t)
        if t in HINGLISH_SLANGS:  found_hinglish.append(t)
        if t in ABBREVIATIONS:    found_abbrevs.append(t)

    # multi-word phrases
    for phrase in INTERNET_SLANGS:
        if " " in phrase and phrase in raw_lower:
            if phrase not in found_internet:
                found_internet.append(phrase)

    # stretched words like "sooooo", "yaaaar"
    stretched = list(set(re.findall(r"\b\w*(.)\1{2,}\w*\b", raw_lower)))

    # emoji detection
    emojis_found = list(set(
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


# ── Phoneme / sound pattern hints ────────────────────────────
PHONEME_PATTERNS = [
    (r"\b\w*kh\w*",         "kh- (Hindi aspirated k)"),
    (r"\b\w*gh\w*",         "gh- (Hindi voiced velar)"),
    (r"\b\w*ch\w*",         "ch- (palatal affricate)"),
    (r"\b\w*jh\w*",         "jh- (Hindi aspirated j)"),
    (r"\b\w*sh\w*",         "sh- (palatal sibilant)"),
    (r"\b\w*th\w*",         "th- (dental/aspirated t)"),
    (r"\b\w*dh\w*",         "dh- (Hindi aspirated d)"),
    (r"\b\w*ph\w*",         "ph- (labial fricative)"),
    (r"\b\w*bh\w*",         "bh- (Hindi aspirated b)"),
    (r"\b\w*aa\b",          "-aa (long a vowel)"),
    (r"\b\w*ee\b",          "-ee (long i vowel)"),
    (r"\b\w*oo\b",          "-oo (long u vowel)"),
    (r"\b\w*wala\b",        "-wala (Hindi agent suffix)"),
    (r"\b\w*ing\b",         "-ing (English progressive)"),
    (r"\b\w*tion\b",        "-tion (English noun suffix)"),
    (r"\b\w*ly\b",          "-ly (English adverb suffix)"),
    (r"\bna\b",             "na (Hindi negation)"),
    (r"\bnahi\b|\bnahin\b", "nahi/nahin (Hindi negation)"),
    (r"\byaar\b|\byar\b",   "yaar (Hinglish address)"),
    (r"\b\w*ness\b",        "-ness (English noun suffix)"),
    (r"\b\w*ize\b|\b\w*ise\b", "-ize/-ise (English verb suffix)"),
]

def detect_phonemes(text):
    text_lower = text.lower()
    found = []
    seen  = set()
    for pattern, label in PHONEME_PATTERNS:
        matches = re.findall(pattern, text_lower)
        if matches and label not in seen:
            found.append({
                "pattern": label,
                "examples": list(set(
                    m if isinstance(m, str) else m[0]
                    for m in matches
                ))[:3],
            })
            seen.add(label)
    return found


# ── Text statistics ───────────────────────────────────────────
def text_stats(text):
    words = text.split()
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


# ── Master analysis function ──────────────────────────────────
def analyse_text(raw_text):
    """
    Runs all rule-based analysis on the raw (uncleaned) text.
    Appended to every model response. No ML models involved.
    """
    tokens  = re.findall(r"\b\w+\b", raw_text.lower())
    scripts = detect_scripts(raw_text)
    langs   = detect_languages(tokens, scripts)
    slangs  = detect_slangs(raw_text, tokens)
    phones  = detect_phonemes(raw_text)
    stats   = text_stats(raw_text)

    roman_tokens = [t for t in tokens if t.isascii()]
    hindi_roman  = [t for t in roman_tokens if t in HINDI_ROMAN_WORDS]
    code_mix_ratio = round(len(hindi_roman) / max(len(roman_tokens), 1), 3)

    return {
        "scripts_detected":   scripts,
        "languages_detected": langs,
        "code_mix_ratio":     code_mix_ratio,
        "slang_analysis":     slangs,
        "phoneme_hints":      phones,
        "text_stats":         stats,
    }


# ═════════════════════════════════════════════════════════════
#  TEXT CLEANING (original — unchanged)
# ═════════════════════════════════════════════════════════════

def clean_news(text):
    text = str(text).lower()
    text = re.sub(r"http\S+|www\.\S+", "", text)
    text = re.sub(r"@\w+", "", text)
    text = re.sub(r"#(\w+)", r"\1", text)
    text = re.sub(r"rt\s+", "", text)
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

def clean_tweet(text):
    if not isinstance(text, str):
        return ""
    text = text.lower()
    text = re.sub(r"http\S+", "", text)
    text = re.sub(r"@\w+", "", text)
    text = re.sub(r"(.)\1{2,}", r"\1\1", text)
    return text.strip()


# ═════════════════════════════════════════════════════════════
#  LOAD MODELS (original — unchanged)
# ═════════════════════════════════════════════════════════════

print(f"\n[1/3] Loading Misinfo model from {MISINFO_MODEL_DIR} ...")
misinfo_tokenizer = AutoTokenizer.from_pretrained(MISINFO_MODEL_DIR)
misinfo_model     = AutoModelForSequenceClassification.from_pretrained(MISINFO_MODEL_DIR)
misinfo_model.to(device).eval()
print("  ✓ Misinfo model ready")

print(f"\n[2/3] Loading Fake News model from {FAKENEWS_MODEL_DIR} ...")
fakenews_tokenizer = AutoTokenizer.from_pretrained(FAKENEWS_MODEL_DIR)
fakenews_model     = AutoModelForSequenceClassification.from_pretrained(FAKENEWS_MODEL_DIR)
fakenews_model.to(device).eval()
print("  ✓ Fake News model ready")

print(f"\n[3/3] Loading EmoSen model from {EMOSEN_MODEL_DIR} ...")
emosen_tokenizer = AutoTokenizer.from_pretrained(EMOSEN_MODEL_DIR)
emosen_model     = AutoModelForSequenceClassification.from_pretrained(EMOSEN_MODEL_DIR)
emosen_model.to(device).eval()

label_encoder = LabelEncoder()
label_encoder.classes_ = np.load(
    os.path.join(EMOSEN_MODEL_DIR, "label_classes.npy"), allow_pickle=True
)
print("  ✓ EmoSen model ready")
print(f"  Sentiment classes: {list(label_encoder.classes_)}\n")


# ═════════════════════════════════════════════════════════════
#  INFERENCE (original — unchanged)
# ═════════════════════════════════════════════════════════════

@torch.no_grad()
def infer(model, tokenizer, text, max_len=256):
    enc = tokenizer(
        text, truncation=True, padding="max_length",
        max_length=max_len, return_tensors="pt"
    )
    enc = {k: v.to(device) for k, v in enc.items()}
    logits = model(**enc).logits
    probs  = F.softmax(logits, dim=1).cpu().numpy()[0]
    return probs


# ═════════════════════════════════════════════════════════════
#  ROUTES
# ═════════════════════════════════════════════════════════════

@app.route("/health")
def health():
    return jsonify({
        "status": "ok", "device": str(device),
        "models": ["misinfo", "fakenews", "emosen"],
        "extras": ["language_detection", "script_detection",
                   "slang_detection", "phoneme_hints", "text_stats"],
    })


@app.route("/predict/misinfo", methods=["POST"])
def predict_misinfo():
    data = request.get_json(silent=True)
    if not data or "text" not in data:
        return jsonify({"error": "Send JSON with a 'text' field."}), 400
    text = data["text"].strip()
    if len(text.split()) < 3:
        return jsonify({"error": "Text too short. Please enter at least 3 words."}), 400

    cleaned = clean_news(text)
    probs   = infer(misinfo_model, misinfo_tokenizer, cleaned, max_len=256)
    pred    = int(probs[1] > 0.5)
    label   = "misinfo" if pred else "nonmisinfo"

    return jsonify({
        "label":           label,
        "confidence":      round(float(probs[pred]) * 100, 2),
        "prob_misinfo":    round(float(probs[1]) * 100, 2),
        "prob_nonmisinfo": round(float(probs[0]) * 100, 2),
        "text_analysis":   analyse_text(text),
    })


@app.route("/predict/fakenews", methods=["POST"])
def predict_fakenews():
    data = request.get_json(silent=True)
    if not data or "text" not in data:
        return jsonify({"error": "Send JSON with a 'text' field."}), 400
    text = data["text"].strip()
    if len(text.split()) < 3:
        return jsonify({"error": "Text too short. Please enter at least 3 words."}), 400

    cleaned  = clean_news(text)
    probs    = infer(fakenews_model, fakenews_tokenizer, cleaned, max_len=256)
    pred_idx = int(np.argmax(probs))
    label    = FAKENEWS_LABEL_MAP.get(pred_idx, str(pred_idx))
    class_scores = {
        FAKENEWS_LABEL_MAP[i]: round(float(probs[i]) * 100, 2)
        for i in range(len(probs))
    }

    return jsonify({
        "label":         label,
        "emoji":         FAKENEWS_EMOJI.get(label, ""),
        "confidence":    round(float(probs[pred_idx]) * 100, 2),
        "all_scores":    class_scores,
        "text_analysis": analyse_text(text),
    })


@app.route("/predict/emosen", methods=["POST"])
def predict_emosen():
    data = request.get_json(silent=True)
    if not data or "text" not in data:
        return jsonify({"error": "Send JSON with a 'text' field."}), 400
    text = data["text"].strip()
    if len(text.split()) < 2:
        return jsonify({"error": "Text too short."}), 400

    cleaned  = clean_tweet(text)
    probs    = infer(emosen_model, emosen_tokenizer, cleaned, max_len=128)
    pred_idx = int(np.argmax(probs))
    label    = label_encoder.inverse_transform([pred_idx])[0]
    class_scores = {
        label_encoder.classes_[i]: round(float(probs[i]) * 100, 2)
        for i in range(len(probs))
    }

    return jsonify({
        "label":         label,
        "emoji":         SENTIMENT_EMOJI.get(label.lower(), "💬"),
        "confidence":    round(float(probs[pred_idx]) * 100, 2),
        "all_scores":    class_scores,
        "text_analysis": analyse_text(text),
    })


@app.route("/predict/all", methods=["POST"])
def predict_all():
    """Run all 3 models + full text analysis on the same text."""
    data = request.get_json(silent=True)
    if not data or "text" not in data:
        return jsonify({"error": "Send JSON with a 'text' field."}), 400

    text    = data["text"].strip()
    results = {"text_analysis": analyse_text(text)}

    try:
        cleaned = clean_news(text)
        probs   = infer(misinfo_model, misinfo_tokenizer, cleaned, 256)
        pred    = int(probs[1] > 0.5)
        label   = "misinfo" if pred else "nonmisinfo"
        results["misinfo"] = {
            "label": label,
            "confidence":      round(float(probs[pred])  * 100, 2),
            "prob_misinfo":    round(float(probs[1])      * 100, 2),
            "prob_nonmisinfo": round(float(probs[0])      * 100, 2),
        }
    except Exception as e:
        results["misinfo"] = {"error": str(e)}

    try:
        cleaned  = clean_news(text)
        probs    = infer(fakenews_model, fakenews_tokenizer, cleaned, 256)
        pred_idx = int(np.argmax(probs))
        label    = FAKENEWS_LABEL_MAP.get(pred_idx, str(pred_idx))
        results["fakenews"] = {
            "label":      label,
            "emoji":      FAKENEWS_EMOJI.get(label, ""),
            "confidence": round(float(probs[pred_idx]) * 100, 2),
            "all_scores": {
                FAKENEWS_LABEL_MAP[i]: round(float(probs[i]) * 100, 2)
                for i in range(len(probs))
            },
        }
    except Exception as e:
        results["fakenews"] = {"error": str(e)}

    try:
        cleaned  = clean_tweet(text)
        probs    = infer(emosen_model, emosen_tokenizer, cleaned, 128)
        pred_idx = int(np.argmax(probs))
        label    = label_encoder.inverse_transform([pred_idx])[0]
        results["emosen"] = {
            "label":      label,
            "emoji":      SENTIMENT_EMOJI.get(label.lower(), "💬"),
            "confidence": round(float(probs[pred_idx]) * 100, 2),
            "all_scores": {
                label_encoder.classes_[i]: round(float(probs[i]) * 100, 2)
                for i in range(len(probs))
            },
        }
    except Exception as e:
        results["emosen"] = {"error": str(e)}

    return jsonify(results)


@app.route("/analyse/text", methods=["POST"])
def analyse_only():
    """
    Text analysis only — no ML model inference.
    For quick language / slang / script checks.
    """
    data = request.get_json(silent=True)
    if not data or "text" not in data:
        return jsonify({"error": "Send JSON with a 'text' field."}), 400
    return jsonify(analyse_text(data["text"].strip()))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
