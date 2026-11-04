import { describe, expect, it } from "vitest";
import { projectUrl, sectionUrl, taskUrl } from "./links";

describe("Todoist links", () => {
  it("builds web app URLs from ids", () => {
    expect(taskUrl("6hw5p5RWpCQCjWgQ")).toBe("https://app.todoist.com/app/task/6hw5p5RWpCQCjWgQ");
    expect(projectUrl("abc")).toBe("https://app.todoist.com/app/project/abc");
    expect(sectionUrl("s 1")).toBe("https://app.todoist.com/app/section/s%201");
  });
});
