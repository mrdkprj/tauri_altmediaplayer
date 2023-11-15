
type Size = {
    bottom:number;
    width:number;
    height:number;
}

const menuItemHeight = 29;
const separatorHeight = 1;
const extra = 10;

export class ContextMenu{

    private name:ContextMenuName;
    private options:Mp.ContextMenu[];
    menu:HTMLElement;
    size:Mp.ContextMenuSize = {
        innerHeight:0,
        outerHeight:0,
        innerWidth:0,
        outerWidth:0
    };
    private submenuSize:{[key:string]:Size} = {};
    private complete = true;
    private handler:(e:Mp.MenuItemClickEvent) => void;

    constructor(name:ContextMenuName, options?:Mp.ContextMenu[]){
        this.name = name;
        if(options){
            this.options = options;
            this.build(this.options)
        }
    }

    onClick(handler:(e:Mp.MenuItemClickEvent) => void){
        this.handler = handler;
    }

    show(revert:boolean){
        if(revert){
            this.menu.classList.add("revert");
            this.menu.style.transform = `translateX(${this.size.outerWidth - this.size.innerWidth}px)`
        }else{
            this.menu.classList.remove("revert");
            this.menu.style.transform = `translateX(0)`
        }
    }

    build(options:Mp.ContextMenu[]){

        this.options = options;

        this.menu = document.createElement("div");
        this.menu.classList.add("menu-container")
        this.menu.setAttribute("menu", "")
        this.menu.tabIndex = 0;
        this.menu.style.position = "fixed"
        this.menu.style.top = "0px";

        this.options.forEach(menuItem => {
            this.menu.append(this.createMenu(menuItem))
            this.size.innerHeight += menuItemHeight
        })

        document.body.append(this.menu)

        this.setSize();

        document.body.removeChild(this.menu)
    }

    private setSize = () => {
        const menuRect = this.menu.getBoundingClientRect()
        this.size.innerHeight = menuRect.height + extra;
        this.size.innerWidth = menuRect.width + extra;
        this.size.outerHeight = this.size.innerHeight
        this.size.outerWidth = this.size.innerWidth

        const keys = Object.keys(this.submenuSize);

        if(!keys.length) return;

        const overflowItems = keys.filter(key => this.submenuSize[key].bottom > this.size.innerHeight)
        if(overflowItems.length){
            const highestChild = overflowItems.reduce((a, b) => this.submenuSize[a].bottom > this.submenuSize[b].bottom ? a : b);
            this.size.outerHeight = this.submenuSize[highestChild].bottom
        }

        const widestChild = Object.keys(this.submenuSize).reduce((a, b) => this.submenuSize[a].width > this.submenuSize[b].width ? a : b);
        const widestSubmenu = this.menu.querySelector(`#${widestChild}`)?.querySelector(".submenu")
        if(widestSubmenu){
            const submenuRect = widestSubmenu.getBoundingClientRect();
            this.size.outerWidth = this.size.innerWidth + submenuRect.width;
        }
    }

    private createId(){
        return "menu" + crypto.randomUUID();
    }

    private createMenu(menuItem:Mp.ContextMenu):Node{

        if(menuItem.type == "checkbox"){
            return this.createCheckboxMenu(menuItem)
        }

        if(menuItem.type == "radio"){
            return this.createCheckboxMenu(menuItem)
        }

        if(menuItem.type == "separator"){
            return this.createSeparator()
        }

        if(menuItem.submenu){
            return this.createSubmenu(menuItem, menuItem.submenu)
        }

        const menu = document.createElement("div");
        menu.id = this.createId()
        menu.classList.add("menu-item")
        this.setupMenu(menu, menuItem)

        return menu
    }

    private createSubmenu(submenuItem:Mp.ContextMenu, submenuMenuItems:Mp.ContextMenu[]){

        const container = document.createElement("div");
        container.id = this.createId();
        container.classList.add("submenu-container", "menu-item")
        container.addEventListener("mouseenter", this.onSubmenuMouseEnter)

        const header = document.createElement("div")
        header.classList.add("submenu-header")
        header.textContent = submenuItem.label ?? ""
        container.append(header)

        const submenu = document.createElement("div");
        submenu.classList.add("submenu")
        submenu.setAttribute("menu", "")
        const menus = submenuMenuItems.map(menuItem => this.createMenu(menuItem))
        submenu.append(...menus)
        container.append(submenu)

        this.submenuSize[container.id] = this.getSubmenuSize(submenuMenuItems)

        return container;

    }

    private getSubmenuSize(submenuMenuItems:Mp.ContextMenu[]){

        let height = 0;
        let width = 0;
        submenuMenuItems.forEach(item => {
            if(item.type === "separator"){
                height += separatorHeight;
            }else{
                height += menuItemHeight
            }

            if(item.label){
                width = width > item.label.length ? width : item.label.length;
            }
        })

        height += extra
        width += extra

        const bottom = this.size.innerHeight + height;
        return { bottom, width, height}
    }

    private onSubmenuMouseEnter = (e:MouseEvent) => {

        const target = e.target as HTMLElement

        if(!this.complete){
            const bottom = e.clientY + this.submenuSize[target.id].height;
            const overflow = bottom - document.documentElement.clientHeight;
            const submenu = target.querySelector(".submenu") as HTMLElement;
            if(overflow > 0){
                submenu.style.top = `${-overflow}px`
            }else{
                submenu.style.top = "0px"
            }

            this.complete = true;
        }

        target.classList.add("submenu-hover");

    }

    private createCheckboxMenu(menuItem:Mp.ContextMenu){
        const menu = document.createElement("div");
        menu.id = this.createId()
        menu.classList.add("checkbox-menu", "menu-item")
        menu.tabIndex = 0

        if(menuItem.checked){
            menu.setAttribute("checked", "")
        }

        this.setupMenu(menu, menuItem)

        return menu;
    }

    private setupMenu(menu:HTMLDivElement, menuItem:Mp.ContextMenu){

        menu.setAttribute("name", menuItem.name)
        menu.setAttribute("data-type", menuItem.type ?? "text")
        menu.setAttribute("data-value", menuItem.value ?? "")
        const menuName = document.createElement("div");
        menuName.textContent = menuItem.label ?? ""
        menuName.style.pointerEvents = "none"
        const separator = document.createElement("div");
        if(menuItem.accelerator){
            separator.style.width = "40px";
        }
        const shortcut = document.createElement("div");
        shortcut.textContent = menuItem.accelerator ?? ""
        shortcut.style.pointerEvents = "none"
        menu.append(menuName, separator, shortcut);

        menu.addEventListener("mousedown", e => {
            e.preventDefault()
            e.stopImmediatePropagation();

        })
        menu.addEventListener("mouseup", this.onMenuItemClick)
    }

    private createSeparator(){
        this.size.innerHeight += separatorHeight
        const separator = document.createElement("div");
        separator.classList.add("menu-separator")
        return separator;
    }

    private onMenuItemClick = (e:MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const target = e.target as HTMLElement;
        const targetType = target.getAttribute("data-type");

        if(!targetType) return;

        if(targetType == "checkbox" || targetType == "radio"){
            this.toggleCheck(e);
        }

        if(this.handler){
            this.handler({contextMenuName:this.name, name:target.getAttribute("name") as Mp.MenuName, value:target.getAttribute("data-value") as Mp.SubMenuName})
        }

    }

    private toggleCheck(e:MouseEvent){

        const target = e.target as HTMLElement;

        if(target.getAttribute("data-type") == "radio"){
            return this.toggleRadio(target);
        }

        if(target.hasAttribute("checked")){
            target.removeAttribute("checked")
        }else{
            target.setAttribute("checked", "")
        }

    }

    private toggleRadio(target:HTMLElement){

        const parent = target.parentElement

        if(!parent?.hasAttribute("menu")) return;

        Array.from(parent.children).forEach(menu => {
            if(menu.id != target.id){
                menu.removeAttribute("checked")
            }
        })

        target.setAttribute("checked", "");
    }

}
