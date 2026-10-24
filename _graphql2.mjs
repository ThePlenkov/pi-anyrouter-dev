import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import https from "node:https";

const query = readFileSync("/tmp/gh-q.graphql", "utf8");
const token = execSync("gh auth token 2>&1").toString().trim();
const body = JSON.stringify({ query });

const opts = {
  hostname: "api.github.com",
  path: "/graphql",
  method: "POST",
  headers: {
    Authorization: "bearer " + token,
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "User-Agent": "bro-act-gate/1.0",
  },
  timeout: 30000,
};

const req = https.request(opts, (res) => {
  let d = "";
  res.on("data", (c) => (d += c));
  res.on("end", () => {
    try {
      const j = JSON.parse(d);
      const t = j.data.repository.pullRequest.reviewThreads.nodes;
      const open = t.filter((x) => !x.isResolved);
      console.log("total:", t.length, "open:", open.length);
      for (const x of open) {
        console.log(
          "\n=== " + x.id + " " + x.path + (x.line ? ":" + x.line : ""),
        );
        for (const c of x.comments.nodes) {
          console.log("[" + c.author.login + "]", (c.body || "").slice(0, 400));
        }
      }
    } catch (e) {
      console.log("parse err", d.slice(-500));
    }
  });
});
req.on("error", (e) => console.log("err", e.message));
req.write(body);
req.end();