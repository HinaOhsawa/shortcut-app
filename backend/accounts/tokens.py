"""メール認証等で使う一回性トークンの生成・検証ユーティリティ。

平文トークンはユーザーへのメール本文にしか登場せず、サーバ側 DB には
sha256 ハッシュのみ保存する。これにより DB 漏洩時の被害を最小化する。
"""

import hashlib
import secrets


def generate_token() -> tuple[str, str]:
    """新しい平文トークンとそのハッシュを返す。

    Returns:
        (plaintext, sha256_hex) のタプル。平文はメールに含めて送り、
        ハッシュを DB に保存する。
    """
    # 32 bytes = 256 bit のエントロピー。base64url で 43 文字程度
    plaintext = secrets.token_urlsafe(32)
    return plaintext, hash_token(plaintext)


def hash_token(plaintext: str) -> str:
    """トークンの sha256 ハッシュを 16 進文字列で返す。"""
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()
