from __future__ import annotations

import base64
import ipaddress
import json
import os
import socket
from io import BytesIO
from typing import Any
from urllib.parse import urlparse

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from .analysis import analyze_images
from .schemas import AnalysisAnswers, AnalysisResponse, ChatTurn, DoctorChatResponse

app = FastAPI(title="Skin AI", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/catalog/shopify")
async def shopify_catalog(
    store: str = Query(...),
    limit: int = Query(default=250, ge=1, le=250),
    currency: str = Query(default="USD"),
    brand: str | None = Query(default=None),
):
    parsed = urlparse(store)
    host = (parsed.hostname or "").strip()
    if parsed.scheme != "https" or not host:
        raise HTTPException(status_code=400, detail="Invalid store URL")

    if host.lower() in {"localhost", "127.0.0.1", "::1"}:
        raise HTTPException(status_code=400, detail="Invalid store URL")

    try:
        ipaddress.ip_address(host)
        raise HTTPException(status_code=400, detail="Invalid store URL")
    except ValueError:
        pass

    try:
        infos = socket.getaddrinfo(host, None)
        for info in infos:
            sockaddr = info[4]
            if not sockaddr:
                continue
            ip_str = sockaddr[0]
            try:
                ip = ipaddress.ip_address(ip_str)
            except ValueError:
                continue
            if (
                ip.is_private
                or ip.is_loopback
                or ip.is_link_local
                or ip.is_reserved
                or ip.is_multicast
                or ip.is_unspecified
            ):
                raise HTTPException(status_code=400, detail="Invalid store URL")
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Invalid store URL")

    base = f"{parsed.scheme}://{parsed.netloc}"
    feed_url = f"{base}/products.json?limit={limit}"

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        res = await client.get(feed_url, headers={"User-Agent": "SkinSense/0.1"})

    if res.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Catalog fetch failed ({res.status_code})")

    data = res.json()
    raw = data.get("products") if isinstance(data, dict) else None
    if not isinstance(raw, list):
        return []

    cur = (currency or "").strip().upper()
    if len(cur) != 3 or not cur.isalpha():
        cur = "USD"

    brand_clean = brand.strip() if isinstance(brand, str) and brand.strip() else None

    out: list[dict[str, Any]] = []
    for p in raw:
        if not isinstance(p, dict):
            continue

        title = p.get("title")
        if not isinstance(title, str) or not title.strip():
            continue

        handle = p.get("handle")
        if isinstance(handle, str) and handle.strip():
            pid = handle.strip()
            url = f"{base}/products/{pid}"
        else:
            pid_raw = p.get("id")
            pid = str(pid_raw).strip() if pid_raw is not None else ""
            if not pid:
                continue
            url = f"{base}/products/{pid}"

        product_type = p.get("product_type")
        vendor = p.get("vendor")
        category = (
            product_type.strip()
            if isinstance(product_type, str) and product_type.strip()
            else vendor.strip()
            if isinstance(vendor, str) and vendor.strip()
            else "Product"
        )

        variants = p.get("variants")
        price: float | None = None
        if isinstance(variants, list) and variants:
            v0 = variants[0]
            if isinstance(v0, dict):
                pr = v0.get("price")
                if isinstance(pr, (int, float)):
                    price = float(pr)
                elif isinstance(pr, str):
                    try:
                        price = float(pr)
                    except Exception:
                        price = None

        if price is None:
            continue

        images = p.get("images")
        image_url: str | None = None
        if isinstance(images, list) and images:
            im0 = images[0]
            if isinstance(im0, dict):
                src = im0.get("src")
                if isinstance(src, str) and src.strip():
                    image_url = src.strip()

        tags_field = p.get("tags")
        raw_tags: list[str] = []
        if isinstance(tags_field, list):
            raw_tags = [t.strip() for t in tags_field if isinstance(t, str) and t.strip()]
        elif isinstance(tags_field, str):
            raw_tags = [t.strip() for t in tags_field.split(",") if t.strip()]

        def _norm_tag(t: str) -> str:
            v = t.strip().lower()
            if not v:
                return ""
            v = v.replace("&", " ")
            v = v.replace("/", " ")
            v = v.replace("-", " ")
            v = " ".join(v.split())
            v = v.replace(" ", "_")
            return v

        normalized_raw = {_norm_tag(t) for t in raw_tags}
        normalized_raw.discard("")

        blob = " ".join(
            [
                title.strip(),
                category.strip(),
                vendor.strip() if isinstance(vendor, str) else "",
                product_type.strip() if isinstance(product_type, str) else "",
                " ".join(raw_tags),
            ]
        ).lower()

        def _has(needle: str) -> bool:
            return needle in blob

        derived_tags: set[str] = set()
        derived_concerns: set[str] = set()

        if _has("vitamin c") or _has("vitamin_c"):
            derived_tags.update({"vitamin_c", "brightening", "antioxidants"})
            derived_concerns.add("uneven_tone")

        if _has("niacinamide"):
            derived_tags.update({"niacinamide", "oil_control", "pores", "barrier"})
            derived_concerns.update({"oiliness", "redness", "uneven_tone"})

        if _has("hyaluronic"):
            derived_tags.update({"hyaluronic_acid", "moisturizer", "barrier"})
            derived_concerns.update({"dryness", "barrier"})

        if _has("ceramide"):
            derived_tags.update({"ceramides", "moisturizer", "barrier"})
            derived_concerns.update({"dryness", "barrier"})

        if _has("retinol") or _has("retinoid"):
            derived_tags.update({"retinoid", "wrinkles", "texture"})
            derived_concerns.update({"wrinkles", "texture"})

        if _has("salicylic") or _has(" bha") or _has("bha "):
            derived_tags.update({"bha", "oil_control", "pores", "texture"})
            derived_concerns.update({"oiliness", "texture"})

        if _has("glycolic") or _has("lactic") or _has(" aha") or _has("aha "):
            derived_tags.update({"aha", "texture", "brightening"})
            derived_concerns.update({"texture", "uneven_tone"})

        if _has("azelaic"):
            derived_tags.update({"azelaic_acid", "redness", "brightening"})
            derived_concerns.update({"redness", "uneven_tone"})

        if _has("peptide"):
            derived_tags.add("peptides")
            derived_concerns.add("wrinkles")

        if _has("caffeine"):
            derived_tags.update({"caffeine", "puffy_eyes"})
            derived_concerns.add("puffy_eyes")

        if _has("sunscreen") or _has("spf") or _has("sun stick"):
            derived_tags.update({"sunscreen", "spf", "uv"})
            derived_concerns.update({"wrinkles", "uneven_tone"})

        if _has("face wash") or _has("cleanser"):
            derived_tags.add("cleanser")

        if _has("moistur") or _has("lotion") or _has("cream"):
            derived_tags.add("moisturizer")

        tags = sorted(derived_tags.union(normalized_raw))
        concerns = sorted(derived_concerns)

        out.append(
            {
                "id": pid,
                "brand": brand_clean,
                "name": title.strip(),
                "category": category,
                "price": price,
                "currency": cur,
                "url": url,
                "imageUrl": image_url,
                "tags": tags,
                "concerns": concerns,
            }
        )

    return out


@app.post("/analyze")
async def analyze(
    images: list[UploadFile] = File(...),
    answers: str | None = Form(default=None),
    debug: bool = Form(default=False),
):
    parsed: AnalysisAnswers | None = None
    if answers:
        try:
            parsed = AnalysisAnswers.model_validate_json(answers)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid answers JSON: {e}")

    try:
        return await analyze_images(images=images, answers=parsed, debug=debug)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def _analysis_to_context(analysis: AnalysisResponse) -> str:
    lines: list[str] = []
    lines.append(f"skin_type: {analysis.skin_type}")
    lines.append(f"overall_score: {analysis.overall_score:.0f}/100")
    if analysis.estimated_fitzpatrick is not None:
        lines.append(f"estimated_fitzpatrick: {analysis.estimated_fitzpatrick}")
    if analysis.skin_age is not None:
        delta = ""
        if analysis.skin_age_delta is not None:
            sign = "+" if analysis.skin_age_delta >= 0 else ""
            delta = f" ({sign}{analysis.skin_age_delta:.1f})"
        lines.append(f"skin_age_estimate: {analysis.skin_age:.1f}{delta}")

    metrics = sorted(analysis.metrics, key=lambda m: float(m.severity), reverse=True)
    lines.append("metrics (higher severity = more visible):")
    for m in metrics[:6]:
        lines.append(
            f"- {m.id}: severity {m.severity:.0f}/100, confidence {m.confidence:.2f}. {m.summary}"
        )

    if analysis.routine:
        lines.append("suggested_routine:")
        for r in analysis.routine[:8]:
            lines.append(f"- {r.time}: {r.step} ({r.why})")

    return "\n".join(lines)


def _turns_to_contents(turns: list[ChatTurn]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for t in turns:
        out.append({"role": t.role, "parts": [{"text": t.text}]})
    return out


def _prepare_image_inline_data(data: bytes, mime: str | None) -> tuple[bytes, str]:
    content_type = (mime or "image/jpeg").lower()
    try:
        img = Image.open(BytesIO(data))
        img = img.convert("RGB")
        max_side = 1024
        w, h = img.size
        mx = max(w, h)
        if mx > max_side:
            scale = max_side / float(mx)
            img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))))

        out = BytesIO()
        img.save(out, format="JPEG", quality=85, optimize=True)
        return out.getvalue(), "image/jpeg"
    except Exception:
        return data, content_type


async def _call_gemini(*, system_instruction: str, contents: list[dict[str, Any]]) -> str:
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not set")

    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
    attempt_contents: list[dict[str, Any]] = list(contents)
    chunks: list[str] = []

    async with httpx.AsyncClient(timeout=60.0) as client:
        for _ in range(2):
            payload: dict[str, Any] = {
                "system_instruction": {"parts": [{"text": system_instruction}]},
                "contents": attempt_contents,
                "generationConfig": {"temperature": 0.35, "maxOutputTokens": 2048},
            }
            res = await client.post(
                url,
                headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
                json=payload,
            )

            if res.status_code != 200:
                raise HTTPException(
                    status_code=502, detail=f"Gemini API error ({res.status_code}): {res.text}"
                )

            data = res.json()

            try:
                cand = (data.get("candidates") or [])[0]
                finish_reason = cand.get("finishReason")
                parts = (cand.get("content") or {}).get("parts") or []
                texts: list[str] = []
                for p in parts:
                    if isinstance(p, dict) and isinstance(p.get("text"), str):
                        texts.append(p["text"])
                chunk = "\n".join(texts).strip() if texts else ""
                if not chunk:
                    return json.dumps(data)[:4000]

                chunks.append(chunk)

                if finish_reason in ("MAX_TOKENS", "MAX_TOKEN"):
                    attempt_contents.append({"role": "model", "parts": [{"text": chunk}]})
                    attempt_contents.append({"role": "user", "parts": [{"text": "Continue."}]})
                    continue

                break
            except Exception:
                return json.dumps(data)[:4000]

    return "\n".join(chunks).strip()


@app.post("/chat", response_model=DoctorChatResponse)
async def chat(
    message: str = Form(...),
    history: str | None = Form(default=None),
    analysis: str | None = Form(default=None),
    products: str | None = Form(default=None),
    user_name: str | None = Form(default=None),
    image: UploadFile | None = File(default=None),
):
    turns: list[ChatTurn] = []
    if history:
        try:
            raw = json.loads(history)
            if isinstance(raw, list):
                for item in raw:
                    turns.append(ChatTurn.model_validate(item))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid history JSON: {e}")

    parsed_analysis: AnalysisResponse | None = None
    if analysis:
        try:
            parsed_analysis = AnalysisResponse.model_validate_json(analysis)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid analysis JSON: {e}")

    allowed_products: list[dict[str, Any]] = []
    if products:
        try:
            raw = json.loads(products)
            if isinstance(raw, list):
                for item in raw[:12]:
                    if not isinstance(item, dict):
                        continue

                    pid = item.get("id")
                    name = item.get("name")
                    url = item.get("url")
                    if not (isinstance(pid, str) and isinstance(name, str) and isinstance(url, str)):
                        continue

                    def _as_str_list(v: Any) -> list[str]:
                        if not isinstance(v, list):
                            return []
                        out: list[str] = []
                        for x in v:
                            if isinstance(x, str):
                                s = x.strip()
                                if s:
                                    out.append(s)
                        return out

                    allowed_products.append(
                        {
                            "id": pid.strip(),
                            "brand": item.get("brand") if isinstance(item.get("brand"), str) else None,
                            "name": name.strip(),
                            "category": item.get("category") if isinstance(item.get("category"), str) else None,
                            "price": item.get("price") if isinstance(item.get("price"), (int, float)) else None,
                            "currency": item.get("currency") if isinstance(item.get("currency"), str) else None,
                            "url": url.strip(),
                            "tags": _as_str_list(item.get("tags")),
                            "skinTypes": _as_str_list(item.get("skinTypes")),
                            "concerns": _as_str_list(item.get("concerns")),
                        }
                    )
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid products JSON: {e}")

    system_lines = [
        "You are an AI dermatology assistant for cosmetic skincare education.",
        "You are not a medical doctor and you must not provide a diagnosis.",
        "Be careful and conservative: explain uncertainty and ask follow-up questions when needed.",
        "If the user mentions severe pain, bleeding, fast-changing lesions, infection, fever, eye involvement, or other urgent symptoms, advise urgent in-person medical care.",
        "Use the scan results below as context, but do not overclaim accuracy (lighting and camera affect results).",
        "Do NOT invent products, brands, prices, or links.",
        "If the user asks for product recommendations and no allowed catalog is provided, recommend ingredient categories instead of specific buyable products.",
    ]

    if user_name and user_name.strip():
        system_lines.append(f"User name: {user_name.strip()}")

    if parsed_analysis is not None:
        system_lines.append("Scan results (data):")
        system_lines.append(_analysis_to_context(parsed_analysis))

    if allowed_products:
        system_lines.append(
            "If the user asks for product recommendations, ONLY recommend products from the allowed catalog below."
        )
        system_lines.append(
            "Do NOT invent products, brands, prices, or links. If none are suitable, say so and suggest ingredient categories instead."
        )
        system_lines.append("Allowed product catalog (buyable):")
        for p in allowed_products:
            brand = p.get("brand")
            cat = p.get("category")
            price = p.get("price")
            cur = p.get("currency")
            tags = p.get("tags")
            concerns = p.get("concerns")
            skin_types = p.get("skinTypes")

            bits: list[str] = []
            bits.append(f"name: {p.get('name')}")
            if isinstance(brand, str) and brand.strip():
                bits.append(f"brand: {brand}")
            if isinstance(cat, str) and cat.strip():
                bits.append(f"category: {cat}")
            if isinstance(price, (int, float)) and isinstance(cur, str) and cur.strip():
                bits.append(f"price: {price:g} {cur}")
            bits.append(f"url: {p.get('url')}")

            if isinstance(skin_types, list) and skin_types:
                bits.append("skinTypes: " + ", ".join(skin_types[:6]))
            if isinstance(concerns, list) and concerns:
                bits.append("concerns: " + ", ".join(concerns[:8]))
            if isinstance(tags, list) and tags:
                bits.append("tags: " + ", ".join(tags[:12]))

            system_lines.append("- " + " | ".join(bits))

    system_instruction = "\n".join(system_lines)

    contents = _turns_to_contents(turns)
    user_parts: list[dict[str, Any]] = [{"text": message.strip()}]

    if image is not None:
        data = await image.read()
        if len(data) > 10_000_000:
            raise HTTPException(status_code=400, detail="Image too large")

        prepared, out_mime = _prepare_image_inline_data(data, image.content_type)
        user_parts.append(
            {
                "inline_data": {
                    "mime_type": out_mime,
                    "data": base64.b64encode(prepared).decode("ascii"),
                }
            }
        )

    contents.append({"role": "user", "parts": user_parts})
    reply = await _call_gemini(system_instruction=system_instruction, contents=contents)
    return DoctorChatResponse(reply=reply)
