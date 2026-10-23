#!/usr/bin/env python3
"""Assina um APK com o APK Signature Scheme v2 (Android 7.0+).

Uso:
  python3 android/tools/assinar_apk.py ENTRADA.apk SAIDA.apk KEYSTORE.p12 SENHA

Serve para assinar o APK sem assinatura gerado pelo GitHub Actions sem
precisar do Android SDK (apksigner). O APK de entrada precisa estar alinhado
(zipalign) e sem assinatura. O workflow .github/workflows/android.yml confere
o resultado com o apksigner oficial.

Depende de: cryptography (pip install cryptography).
"""
import hashlib
import struct
import sys

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import pkcs12

CHUNK = 1024 * 1024
V2_BLOCK_ID = 0x7109871A
RSA_PKCS1_SHA256 = 0x0103
MAGIC = b"APK Sig Block 42"


def u32(n):
    return struct.pack("<I", n)


def u64(n):
    return struct.pack("<Q", n)


def lp(data):
    """Prefixo de tamanho uint32 little-endian."""
    return u32(len(data)) + data


def achar_eocd(apk):
    # EOCD: assinatura 0x06054b50, 22 bytes + comentario (ate 65535).
    for i in range(len(apk) - 22, max(-1, len(apk) - 22 - 65536), -1):
        if apk[i:i + 4] == b"PK\x05\x06":
            (com_len,) = struct.unpack_from("<H", apk, i + 20)
            if i + 22 + com_len == len(apk):
                return i
    raise SystemExit("EOCD nao encontrado: arquivo nao e um ZIP valido")


def digest_secoes(secoes):
    chunk_digests = []
    for secao in secoes:
        for i in range(0, len(secao), CHUNK):
            parte = secao[i:i + CHUNK]
            chunk_digests.append(
                hashlib.sha256(b"\xa5" + u32(len(parte)) + parte).digest()
            )
    return hashlib.sha256(
        b"\x5a" + u32(len(chunk_digests)) + b"".join(chunk_digests)
    ).digest()


def main():
    if len(sys.argv) != 5:
        raise SystemExit(__doc__)
    entrada, saida, keystore, senha = sys.argv[1:]

    with open(keystore, "rb") as f:
        chave, cert, _ = pkcs12.load_key_and_certificates(f.read(), senha.encode())
    cert_der = cert.public_bytes(serialization.Encoding.DER)
    pub_der = chave.public_key().public_bytes(
        serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo
    )

    with open(entrada, "rb") as f:
        apk = f.read()

    eocd_off = achar_eocd(apk)
    cd_size, cd_off = struct.unpack_from("<II", apk, eocd_off + 12)
    if cd_off + cd_size != eocd_off:
        raise SystemExit("Central directory inesperado (APK ja assinado ou ZIP64?)")
    if apk[cd_off - 16:cd_off] == MAGIC:
        raise SystemExit("APK ja tem bloco de assinatura")

    conteudo = apk[:cd_off]
    cd = apk[cd_off:eocd_off]
    eocd = apk[eocd_off:]

    # No digest, o offset do central directory no EOCD aponta para o inicio do
    # bloco de assinatura, que fica exatamente onde o CD comecava.
    digest = digest_secoes([conteudo, cd, eocd])

    signed_data = (
        lp(lp(u32(RSA_PKCS1_SHA256) + lp(digest)))  # digests
        + lp(lp(cert_der))  # certificates
        + lp(b"")  # additional attributes
    )
    assinatura = chave.sign(signed_data, padding.PKCS1v15(), hashes.SHA256())
    signer = (
        lp(signed_data)
        + lp(lp(u32(RSA_PKCS1_SHA256) + lp(assinatura)))
        + lp(pub_der)
    )
    v2_value = lp(lp(signer))

    par = u32(V2_BLOCK_ID) + v2_value
    pares = u64(len(par)) + par
    tamanho = len(pares) + 8 + 16  # pares + tamanho repetido + magic
    bloco = u64(tamanho) + pares + u64(tamanho) + MAGIC

    novo_cd_off = cd_off + len(bloco)
    novo_eocd = eocd[:16] + u32(novo_cd_off) + eocd[20:]

    with open(saida, "wb") as f:
        f.write(conteudo + bloco + cd + novo_eocd)
    print(f"APK assinado: {saida}")


if __name__ == "__main__":
    main()
