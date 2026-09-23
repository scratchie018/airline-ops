export type MenuCategory = "drink" | "snack";

export interface MenuItem {
  name: string;
  imageUrl: string;
  category: MenuCategory;
}

/** Fixed in-flight cabin service menu - not airline-configurable for now, same
 * simple approach as the aircraft model list, kept as data (with an image per
 * item) rather than free text so crew see a consistent, typo-free set of
 * items to fulfill and passengers get a visual menu to order from. */
export const MENU_ITEMS = [
  { name: "Water", imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT5in4WHdPb2g9vxcUBgRsMCSEku2hOD1Cb30UXiIu_NQ&s=10", category: "drink" },
  { name: "Ginger Ale", imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTFtk7wUfStlXBz8BqtvA-7qZDdn4Hwn4Jb96szrcJ3KpYaB1Hl_S1ELp7K&s=10", category: "drink" },
  { name: "Coconut Water", imageUrl: "https://www.pngall.com/wp-content/uploads/23/Taste-Nirvana-Coconut-Water-Bottle-PNG-thumb.webp", category: "drink" },
  { name: "Peppermint Tea", imageUrl: "https://static.vecteezy.com/system/resources/thumbnails/059/063/730/small/refreshing-cup-of-green-mint-tea-with-fresh-mint-leaves-isolated-on-transparent-background-png.png", category: "drink" },
  { name: "Sparkling Water", imageUrl: "https://static.vecteezy.com/system/resources/previews/058/374/662/non_2x/tonic-water-isolate-on-transparent-background-png.png", category: "drink" },
  { name: "Hot Cocoa", imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRsW3LN27UluawoaYjdHy3PrPwY2Zt4SAw7AhcZLD7fy_Ie5MJGOo3Noiw&s=10", category: "drink" },
  { name: "Orange Juice", imageUrl: "https://static.vecteezy.com/system/resources/thumbnails/044/632/999/small/refreshing-orangy-bliss-enjoy-a-glass-of-orange-juice-with-fresh-orange-slices-free-png.png", category: "drink" },
  { name: "Apple Juice", imageUrl: "https://www.pngall.com/wp-content/uploads/15/Apple-Juice-PNG-Image-HD.png", category: "drink" },
  { name: "Mixed Nuts", imageUrl: "https://static.vecteezy.com/system/resources/thumbnails/047/706/308/small/mixed-fruit-nuts-png.png", category: "snack" },
  { name: "Pretzels", imageUrl: "https://pngimg.com/uploads/pretzel/pretzel_PNG8.png", category: "snack" },
  { name: "Dark Chocolate", imageUrl: "https://i.pinimg.com/736x/dd/d8/7e/ddd87e403007268ab6c077fc21be36a2.jpg", category: "snack" },
  { name: "Cheese And Crackers", imageUrl: "https://static.vecteezy.com/system/resources/thumbnails/047/490/666/small/cheese-and-crackers-on-transparent-background-free-png.png", category: "snack" },
  { name: "Oat Bar", imageUrl: "https://img.magnific.com/premium-psd/strawberry-oat-nut-bar-isolated-transparent-background_220739-5734.jpg", category: "snack" },
  { name: "Popcorn", imageUrl: "https://freepngimg.com/save/23443-popcorn-image/1100x1424", category: "snack" },
] as const satisfies MenuItem[];

/** Just the names, in menu order - what gets validated/stored server-side and
 * shown in any plain list. */
export const MENU_ITEM_NAMES = MENU_ITEMS.map((i) => i.name) as [string, ...string[]];

export type MenuItemName = (typeof MENU_ITEMS)[number]["name"];
