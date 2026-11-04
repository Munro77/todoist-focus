// Web links into Todoist. Same bare-id forms Doist's own SDK falls back to;
// on phones with the Todoist app installed these usually open the app.
const WEB = "https://app.todoist.com/app/";

export const taskUrl = (id: string) => WEB + "task/" + encodeURIComponent(id);
export const projectUrl = (id: string) => WEB + "project/" + encodeURIComponent(id);
export const sectionUrl = (id: string) => WEB + "section/" + encodeURIComponent(id);
