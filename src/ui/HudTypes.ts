export type DecorShopHandlers = {
  onBuyItem: (id: string) => void;
  onBuyWall: (id: string) => void;
  onBuyFloor: (id: string) => void;
  onRestore: (id: string) => void;
  onResetLayout: () => void;
  onClose: () => void;
};
