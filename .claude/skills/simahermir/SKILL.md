---
name: simahermir
description: Símahermirinn — sjá hvernig síða, flipi eða mockup í Brunahólfs-hubbnum lítur út í síma ÁÐUR en Agnar þarf að opna hana. „skot" tekur mynd í 360/390/412 px með alvöru tækjahermun og setur þær á eina samanburðarmynd sem er send í síma Agnars; „opna" opnar smellanlegan símaglugga á tölvunni. Tólið býr í systurrepóinu (../slokkvitaeki/tools/simahermir.cjs). Notaðu við alla hönnun og lagfæringu á símaútliti, fyrir og eftir breytingu. Kveikjuorð: símahermir, hermir, emulator, mobile view, mobile preview, símaútlit, hvernig lítur þetta út í síma, símaskjáskot, phone frame, mockup í síma, 360, 390, 412.
---

# Símahermir (Brunahólf)

Tólið og full lýsing eru í systurrepóinu: **`../slokkvitaeki/.claude/skills/simahermir/SKILL.md`** — lestu hana fyrst
(keyrslureglur, mockup-reglur, gildrur, lokagátlisti). Ein skrá á að eiga þekkinguna; hér er aðeins það sem á við hubbinn.

```bash
export HERMIR_KAKA='<kaka úr: select kaka from innri.lotu_koku(10, 1);>'     # aldrei í skrá, aldrei uid 1
node ../slokkvitaeki/tools/simahermir.cjs skot --vefur bh                    # forsíða hubbsins
node ../slokkvitaeki/tools/simahermir.cjs skot "#krofuyfirlit" --vefur bh    # flipi
node ../slokkvitaeki/tools/simahermir.cjs skot "eydublod.html" --vefur bh    # iframe-undirsíða ein og sér
node ../slokkvitaeki/tools/simahermir.cjs skot "http://localhost:5601/" --taeki 360,390   # óbirt breyting (vidmotsprof-þjónninn)
node ../slokkvitaeki/tools/simahermir.cjs opna --vefur bh                    # smellanlegur gluggi fyrir Agnar við tölvuna
```

Lestu `…-samanburdur.png` með `Read`, sendu Agnari hana með `SendUserFile`, og segðu „prófað í hermi".

**Munurinn á þessu og 📱 viewmode-rofanum (`js/viewmode.js`):** rofinn er iframe í 390 px inni í hubbnum, góður þegar
Agnar situr við tölvuna. Hermirinn hermir líka snertingu, síma-UA og `screen`, tekur þrjár breiddir í einu og skilar
mynd sem kemst í símann hans. Hubbinn velur símaútlit af breidd (`@media`), svo hér þarf engan sýnarham að þvinga.
