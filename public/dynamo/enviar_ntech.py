# -*- coding: utf-8 -*-
"""
NTECH · Gestão de Projetos — envio dos dados do modelo Revit (Dynamo)

Como usar (Dynamo 2.13+ no Revit 2022+, motor CPython3):
  1. Crie um nó "Python Script" e cole este código.
  2. Ligue 4 entradas:
       IN[0]  URL       -> copiada em Configurações > Integração com Dynamo
       IN[1]  Token     -> gerado na mesma tela (ntk_...)
       IN[2]  Código    -> código do projeto no sistema (ex.: P2026-001)
       IN[3]  Enviar    -> Boolean (True para enviar; False só mostra a prévia)
  3. Rode. A saída (OUT) mostra o resumo do que foi lido e a resposta do sistema.

O que é enviado:
  - Quadros (equipamentos elétricos) e seus circuitos: número, descrição,
    potência aparente (VA), polos/fases, tensão, disjuntor (A) e cabo.
  - Quantitativos: eletrodutos e eletrocalhas (metros por tipo/diâmetro),
    luminárias, tomadas e dispositivos (unidades por tipo).
"""
import json
import os
import urllib.request
import urllib.error

import clr
clr.AddReference("RevitAPI")
clr.AddReference("RevitServices")
from Autodesk.Revit.DB import (  # noqa: E402
    BuiltInCategory,
    BuiltInParameter,
    FilteredElementCollector,
    UnitTypeId,
    UnitUtils,
)
from Autodesk.Revit.DB.Electrical import ElectricalSystem  # noqa: E402
from RevitServices.Persistence import DocumentManager  # noqa: E402

doc = DocumentManager.Instance.CurrentDBDocument

url = IN[0]  # noqa: F821
token = IN[1]  # noqa: F821
codigo = IN[2]  # noqa: F821
enviar = bool(IN[3]) if len(IN) > 3 else False  # noqa: F821


def converter(valor, unidade):
    try:
        return round(UnitUtils.ConvertFromInternalUnits(valor, unidade), 2)
    except Exception:
        return None


def nome_tipo(el):
    try:
        t = doc.GetElement(el.GetTypeId())
        familia = t.FamilyName if hasattr(t, "FamilyName") else ""
        return ("%s : %s" % (familia, t.Name)).strip(" :")
    except Exception:
        return el.Name


# ---------------------------------------------------------------- circuitos
FASES_POR_POLOS = {1: "", 2: "AB", 3: "ABC"}
quadros = {}
for sis in FilteredElementCollector(doc).OfClass(ElectricalSystem):
    painel = sis.BaseEquipment
    if painel is None:
        continue  # circuito sem quadro
    nome_quadro = painel.Name
    q = quadros.setdefault(nome_quadro, {"nome": nome_quadro, "circuitos": []})
    polos = sis.PolesNumber or 1
    circuito = {
        "circuito": str(sis.CircuitNumber or ""),
        "descricao": str(sis.LoadName or ""),
        "potencia_va": converter(sis.ApparentLoad, UnitTypeId.VoltAmperes) or 0,
        "polos": int(polos),
        "fases": FASES_POR_POLOS.get(int(polos), ""),
    }
    tensao = converter(sis.Voltage, UnitTypeId.Volts)
    if tensao:
        circuito["tensao_v"] = tensao
        q.setdefault("tensao", "%d V" % tensao)
    disj = sis.Rating
    if disj:
        circuito["disjuntor_a"] = converter(disj, UnitTypeId.Amperes)
    try:
        if sis.WireSizeString:
            circuito["secao_mm2"] = str(sis.WireSizeString)
    except Exception:
        pass
    q["circuitos"].append(circuito)

# ------------------------------------------------------------ quantitativos
quantitativos = {}


def somar(item, unidade, qtd):
    chave = (item, unidade)
    quantitativos[chave] = quantitativos.get(chave, 0) + qtd


for cat, rotulo in ((BuiltInCategory.OST_Conduit, "Eletroduto"), (BuiltInCategory.OST_CableTray, "Eletrocalha")):
    for el in FilteredElementCollector(doc).OfCategory(cat).WhereElementIsNotElementType():
        p = el.get_Parameter(BuiltInParameter.CURVE_ELEM_LENGTH)
        if p is None:
            continue
        metros = converter(p.AsDouble(), UnitTypeId.Meters) or 0
        diam = el.get_Parameter(BuiltInParameter.RBS_CONDUIT_DIAMETER_PARAM)
        extra = (" Ø" + diam.AsValueString()) if diam is not None and diam.AsValueString() else ""
        somar("%s %s%s" % (rotulo, nome_tipo(el), extra), "m", metros)

for cat, rotulo in (
    (BuiltInCategory.OST_LightingFixtures, "Luminária"),
    (BuiltInCategory.OST_ElectricalFixtures, "Tomada/ponto"),
    (BuiltInCategory.OST_LightingDevices, "Interruptor"),
    (BuiltInCategory.OST_ElectricalEquipment, "Quadro/equipamento"),
):
    for el in FilteredElementCollector(doc).OfCategory(cat).WhereElementIsNotElementType():
        somar("%s %s" % (rotulo, nome_tipo(el)), "un", 1)

payload = {
    "projeto": str(codigo).strip().upper(),
    "arquivo": os.path.basename(doc.PathName or doc.Title),
    "quadros": sorted(quadros.values(), key=lambda q: q["nome"]),
    "quantitativos": [
        {"item": item, "unidade": un, "quantidade": round(qtd, 2)}
        for (item, un), qtd in sorted(quantitativos.items())
    ],
}

resumo = "%d quadro(s), %d circuito(s), %d item(ns) de quantitativo" % (
    len(payload["quadros"]),
    sum(len(q["circuitos"]) for q in payload["quadros"]),
    len(payload["quantitativos"]),
)

if not enviar:
    OUT = ["PRÉVIA (IN[3] = False, nada foi enviado)", resumo, payload]
else:
    req = urllib.request.Request(
        str(url),
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + str(token)},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            OUT = ["ENVIADO", json.loads(r.read().decode("utf-8"))]
    except urllib.error.HTTPError as e:
        OUT = ["ERRO %d" % e.code, e.read().decode("utf-8", "replace")]
    except Exception as e:  # sem internet, URL errada etc.
        OUT = ["ERRO", str(e)]
