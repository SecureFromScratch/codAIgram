import { registerVisualLifecycle } from './test-support.js';
import { registerShowChainIncomingOnlyCase } from './cases/visibility/show-chain-incoming-only.case.js';
import { registerEscapeClosesContextMenuCase } from './cases/visibility/escape-closes-context-menu.case.js';
import { registerOutsideClickClosesContextMenuCase } from './cases/visibility/outside-click-closes-context-menu.case.js';
import { registerMemberContextMenuAskAboutCase } from './cases/visibility/member-context-menu-ask-about.case.js';
import { registerEditorMemberContextMenuAskAboutCase } from './cases/visibility/editor-member-context-menu-ask-about.case.js';
import { registerAskAboutMemberHeaderCase } from './cases/chat/ask-about-member-header.case.js';
import { registerClassNameContextMenuActualCodeCase } from './cases/visibility/class-name-context-menu-actual-code.case.js';
import { registerClassNameContextMenuToggleActualCodeCase } from './cases/visibility/class-name-context-menu-toggle-actual-code.case.js';

registerVisualLifecycle();
registerShowChainIncomingOnlyCase();
registerEscapeClosesContextMenuCase();
registerOutsideClickClosesContextMenuCase();
registerMemberContextMenuAskAboutCase();
registerEditorMemberContextMenuAskAboutCase();
registerAskAboutMemberHeaderCase();
registerClassNameContextMenuActualCodeCase();
registerClassNameContextMenuToggleActualCodeCase();
