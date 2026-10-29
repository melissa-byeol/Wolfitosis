import time, sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080/index.html"
OUT = "/workspace/capturas"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL); page.wait_for_timeout(800)
    page.screenshot(path=f"{OUT}/01_estado_inicial.png")

    # --- Captura de pantalla ANTES del fix: click en zona vacia mueve TODOS los lobitos ---
    for i in range(3):  # generar 3 lobitos
        page.evaluate("spawnLobito()"); page.wait_for_timeout(100)
    n1 = page.evaluate("() => gameState.lobitos.length")
    print("lobitos generados (bloque 1):", n1)
    page.evaluate("""() => {
        gameState.lobitos.forEach((l,i)=>{ l.x=100+i*40; l.y=100; l.targetX=l.x; l.targetY=l.y; });
    }""")
    page.mouse.click(900, 600)  # clic en zona vacia SIN seleccion
    page.wait_for_timeout(150)
    page.screenshot(path=f"{OUT}/02_antes_clic_zona_vacía_mueve_TODOS.png")
    todos_se_mueven = page.evaluate("""() => gameState.lobitos.every(l => Math.abs(l.targetX-900)<5)""")

    # --- Comportamiento NUEVO (post-fix): un solo clic selecciona al lobito ---
    page.reload(); page.wait_for_timeout(500)
    for i in range(2):
        page.evaluate("spawnLobito()"); page.wait_for_timeout(100)
    n2 = page.evaluate("() => gameState.lobitos.length")
    print("lobitos generados (bloque 2):", n2)
    pos = page.evaluate("""() => {
        const r = [];
        gameState.lobitos.forEach((l,i)=>{ l.x=300+i*120; l.y=300; l.targetX=l.x; l.targetY=l.y; r.push({x:l.x,y:l.y}); });
        return r;
    }""")
    if not pos: raise SystemExit("no hay lobitos en bloque 2")
    page.mouse.click(pos[0]["x"], pos[0]["y"])  # clic simple sobre el lobito 1
    page.wait_for_timeout(200)
    sel = page.evaluate("() => gameState.selectedLobitos.length")
    page.screenshot(path=f"{OUT}/03_después_fix_clic_simple_selecciona.png")

    # Mover SOLO al seleccionado hacia (900, 600)
    page.mouse.click(900, 600)
    page.wait_for_timeout(300)
    movidos = page.evaluate("""() => ({
        selMovido: Math.abs(gameState.selectedLobitos[0].targetX-900)<5 || gameState.selectedLobitos[0].x>700,
        otroQuieto: gameState.lobitos.find(l=>!gameState.selectedLobitos.includes(l)).targetX < 500
    })""")
    page.screenshot(path=f"{OUT}/04_después_fix_solo_se_mueve_el_seleccionado.png")

    # Clic fuera deselecciona (comportamiento RTS)
    page.mouse.click(1100, 150)
    page.wait_for_timeout(100)
    sel_after = page.evaluate("() => gameState.selectedLobitos.length")

    # --- Cortar arbol: hitbox ahora incluye el tronco (click en y+20 bajo copa) ---
    tree = page.evaluate("""() => {
        gameState.trees.length = 0;
        const t = new Tree(600, 400); gameState.trees.push(t);
        return {x:t.x, y:t.y};
    }""")
    page.mouse.click(tree["x"], tree["y"] + 25)  # pega al tronco, antes fallaba
    clicks_ok = page.evaluate("() => gameState.trees[0].clicks")
    page.screenshot(path=f"{OUT}/05_hitbox_árbol_con_tronco.png")

    # Terminar el arbol -> suelta madera, NO construye cama automatica
    page.mouse.click(tree["x"], tree["y"] + 25)
    page.mouse.click(tree["x"], tree["y"] + 25)
    page.wait_for_timeout(200)
    estado = page.evaluate("""() => ({madera: gameState.wood, camas: gameState.beds.length,
                                     botones: document.getElementById('bed-btn').disabled})""")
    page.screenshot(path=f"{OUT}/06_madera_suelta_sin_cama_automática.png")

    # Boton manual: construir cama gastando 3 maderas
    if estado["madera"] >= 3:
        page.click("#bed-btn"); page.wait_for_timeout(200)
    camas_final = page.evaluate("() => gameState.beds.length")
    page.screenshot(path=f"{OUT}/07_cama_construida_manualmente.png")

    browser.close()

print("=== RESULTADOS DE PRUEBA ===")
print(f"[ANTES del fix]  Sin seleccion, un clic mueve TODOS los lobitos: {todos_se_mueven}")
print(f"[DESPUÉS fix]    Clic simple sobre lobito -> seleccionados: {sel} (esperado 1)")
print(f"[DESPUÉS fix]    Solo se mueve el seleccionado: {movidos}")
print(f"[DESPUÉS fix]    Clic en zona vacia deselecciona: {sel_after} (esperado 0)")
print(f"[DESPUÉS fix]    Click en tronco cuenta para talar (hitbox): {clicks_ok} (esperado 1)")
print(f"[DESPUÉS fix]    Al talar: madera={estado['madera']}, camas_automaticas={estado['camas']} (esperado 0), boton cama habilitado={not estado['botones']}")
print(f"[DESPUÉS fix]    Cam tras construir manual: {camas_final} (esperado 1)")
print(f"Errores JS: {errors if errors else 'ninguno'}")
