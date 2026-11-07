import { iniciarMenu } from "./telas/menu";
import { iniciarSubmenu } from "./telas/submenu";
import { SUBMENUS, TelaSubmenu } from "./submenus-config";

const tela = (document.body.dataset.tela ?? "menu") as TelaSubmenu | "menu";
if (tela === "menu") {
  iniciarMenu();
} else if (SUBMENUS[tela]) {
  iniciarSubmenu(tela, SUBMENUS[tela]);
} else {
  console.error("[FinDesk] tela desconhecida:", tela);
}
