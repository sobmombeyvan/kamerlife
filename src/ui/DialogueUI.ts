export type DialogueHandlers = {
  onClose: () => void;
  onChoice?: (id: string) => void;
};

export class DialogueUI {
  private readonly root: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'dialogue';
    this.root.className = 'dialogue hidden';
    parent.appendChild(this.root);
  }

  show(
    name: string,
    role: string,
    lines: string[],
    choices: Array<{ id: string; label: string }>,
    handlers: DialogueHandlers,
    relationLabel?: string,
  ): void {
    const rel = relationLabel ? `<em class="dlg-rel">${relationLabel}</em>` : '';
    const choiceHtml = choices
      .map((c) => `<button type="button" class="dlg-choice" data-id="${c.id}">${c.label}</button>`)
      .join('');
    this.root.innerHTML = `
      <div class="dlg-panel">
        <div class="dlg-head"><strong>${name}</strong><span>${role}</span>${rel}</div>
        <p class="dlg-line">${lines[0] ?? '…'}</p>
        <div class="dlg-choices">${choiceHtml}</div>
      </div>
    `;
    this.root.classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
    this.root.querySelectorAll('[data-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.id!;
        if (id === 'bye') {
          this.hide();
          handlers.onClose();
        } else {
          handlers.onChoice?.(id);
        }
      });
    });
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  isOpen(): boolean {
    return !this.root.classList.contains('hidden');
  }
}

export function dialogueForRole(
  role: string,
  affinity = 20,
): { lines: string[]; choices: Array<{ id: string; label: string }> } {
  const warm = affinity >= 55;
  if (role === 'security') {
    return {
      lines: [
        warm
          ? 'Ah c’est toi ! Tout est calme, passe une bonne journée.'
          : 'Tout va bien ici. Respectez les consignes et circulez tranquillement.',
      ],
      choices: [
        { id: 'chat', label: warm ? 'Prendre des nouvelles' : 'Discuter' },
        { id: 'dir', label: 'Où est le centre-ville ?' },
        { id: 'bye', label: 'Au revoir' },
      ],
    };
  }
  if (role === 'employee') {
    return {
      lines: [
        warm
          ? 'Content de te revoir ! Tu veux commander quelque chose ?'
          : 'Bienvenue ! Nos rayons sont ouverts. Besoin d’une direction ?',
      ],
      choices: [
        { id: 'shop', label: 'Qu’est-ce que vous vendez ?' },
        { id: 'chat', label: 'Discuter' },
        { id: 'bye', label: 'Merci' },
      ],
    };
  }
  if (role === 'student') {
    return {
      lines: [
        warm
          ? 'Hey ! On se croise souvent. Tu vas vers Ngoa-Ekellé aussi ?'
          : 'Je vais vers Ngoa-Ekellé. La ville est animée aujourd’hui !',
      ],
      choices: [
        { id: 'uni', label: 'Parler de l’université' },
        { id: 'chat', label: 'Bavarder' },
        { id: 'bye', label: 'Bonne route' },
      ],
    };
  }
  if (role === 'police') {
    return {
      lines: [
        warm
          ? 'Tout calme. Si tu as un souci, tu m’appelles.'
          : 'Police nationale. Papiers en règle, on circule.',
      ],
      choices: [
        { id: 'chat', label: 'Discuter' },
        { id: 'dir', label: 'Où est le commissariat ?' },
        { id: 'bye', label: 'Bonne ronde' },
      ],
    };
  }
  if (role === 'business') {
    return {
      lines: [
        warm
          ? 'On se croise au Plateau ! Un café après le bureau ?'
          : 'Réunion, appels, Yaoundé n’arrête pas. Tu bosses dans quoi ?',
      ],
      choices: [
        { id: 'chat', label: 'Parler business' },
        { id: 'bye', label: 'Bonne journée' },
      ],
    };
  }
  if (role === 'vendor') {
    return {
      lines: [
        warm
          ? 'Pour toi, prix ami. Banane, sim, chargeur — tu prends quoi ?'
          : 'Sista, frère, viens voir ! Prix du marché.',
      ],
      choices: [
        { id: 'shop', label: 'Regarder la marchandise' },
        { id: 'chat', label: 'Discuter' },
        { id: 'bye', label: 'Plus tard' },
      ],
    };
  }
  if (role === 'thief') {
    return {
      lines: [
        warm ? 'C’est bon, c’est bon, on se connaît. Je passe mon chemin.' : 'Quoi ? J’attends quelqu’un. Circule.',
      ],
      choices: [
        { id: 'chat', label: 'Insister' },
        { id: 'bye', label: 'Laisser' },
      ],
    };
  }
  if (role === 'sex_worker') {
    return {
      lines: [
        warm
          ? 'Tu es revenu. On reste parler un moment, rien d’autre si tu veux.'
          : 'Tu cherches de la compagnie ? On peut juste discuter.',
      ],
      choices: [
        { id: 'chat', label: 'Discuter' },
        { id: 'bye', label: 'Non merci' },
      ],
    };
  }
  if (role === 'tourist') {
    return {
      lines: [
        warm
          ? 'Grâce à toi j’ai adoré Mokolo ! Autre conseil ?'
          : 'Nsimalen ou le marché Mokolo — que me conseillez-vous ?',
      ],
      choices: [
        { id: 'tip', label: 'Donner un conseil' },
        { id: 'chat', label: 'Discuter' },
        { id: 'bye', label: 'Bonne visite' },
      ],
    };
  }
  return {
    lines: [
      warm
        ? 'Salut mon pote ! On prend un café un de ces jours ?'
        : 'Salut ! Belle journée à Yaoundé, non ?',
    ],
    choices: [
      { id: 'chat', label: 'Discuter' },
      { id: 'bye', label: 'Salut' },
    ],
  };
}
