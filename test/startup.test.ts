import { assert } from "chai";
import { config } from "../package.json";
import { buildCliArgs } from "../src/modules/heartbeat";
import { getCliPath } from "../src/modules/wakatime-cli";

function buildMinimalPdf(): string {
  // A tiny but valid single-page PDF, built by hand so the test needs no
  // external fixture or network access.
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << >> /Contents 4 0 R >>",
    "<< /Length 0 >>\nstream\n\nendstream",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += "xref\n0 5\n0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}

describe("startup", function () {
  it("should have plugin instance defined", function () {
    assert.isNotEmpty(Zotero[config.addonInstance]);
  });

  it("should finish initialization on Zotero 10", function () {
    assert.match(Zotero.version, /^10\./);
    assert.isTrue(Zotero[config.addonInstance].data.initialized);
    assert.isTrue(Zotero[config.addonInstance].data.alive);
  });

  it("should execute the installed WakaTime CLI", async function () {
    const { Subprocess } = ChromeUtils.importESModule(
      "resource://gre/modules/Subprocess.sys.mjs",
    );
    const path = getCliPath();
    const process = await Subprocess.call({
      command: path,
      arguments: ["--version"],
    });
    const output = await process.stdout.readString();
    assert.equal((await process.wait()).exitCode, 0);
    assert.match(output, /\d+\.\d+/);
  });

  it("should build Zotero 10 heartbeat CLI args", function () {
    const args = buildCliArgs({
      entity: "Zotero 10 compatibility test",
      entityType: "app",
      category: "researching",
      project: "My Library",
      isWrite: true,
    });
    assert.include(args, "Zotero 10 compatibility test");
    assert.include(args, `zotero/${Zotero.version} zotero-wakatime/0.1.0`);
    assert.include(args, "--write");
  });

  it("should attach readers and track annotation events on Zotero 10", async function () {
    this.timeout(30000);

    const originalDebug = Zotero.debug;
    const messages: string[] = [];
    Zotero.debug = (message: any, ...args: any[]) => {
      messages.push(String(message));
      return originalDebug(message, ...args);
    };

    const waitFor = async (predicate: () => boolean, what: string) => {
      const deadline = Date.now() + 20000;
      while (!predicate()) {
        if (Date.now() > deadline) {
          throw new Error(
            `Timed out waiting for ${what}\nDebug messages:\n${messages.join("\n")}`,
          );
        }
        await Zotero.Promise.delay(100);
      }
    };

    let reader: any;
    let item: any;
    try {
      const path = PathUtils.join(
        Zotero.DataDirectory.dir,
        "compatibility-test.pdf",
      );
      await IOUtils.writeUTF8(path, buildMinimalPdf());

      item = new Zotero.Item("journalArticle");
      item.setField("title", "Zotero 10 compatibility test");
      await item.saveTx();

      const attachment = await Zotero.Attachments.importFromFile({
        file: path,
        parentItemID: item.id,
      });

      reader = await Zotero.Reader.open(attachment.id);

      // The plugin attaches to the reader via the "tab select" notifier. On
      // Zotero 10 it must first wait for the nested PDF viewer iframe to load,
      // so poll for the plugin's own confirmation message.
      await waitFor(
        () =>
          messages.some((message) =>
            message.includes("attached listeners to inner iframe"),
          ),
        "plugin reader listener attachment",
      );

      // Sanity-check the field path the plugin depends on is reachable.
      const primaryView = reader._internalReader?._primaryView;
      if (primaryView?.initializedPromise) {
        await primaryView.initializedPromise;
      }
      assert.exists(
        reader._internalReader?._primaryView?._iframeWindow,
        "PDF viewer iframe window used by plugin",
      );

      // Creating an annotation fires an "item add" notifier that the plugin
      // should observe and turn into a heartbeat.
      messages.length = 0;
      const annotation = new Zotero.Item("annotation");
      annotation.libraryID = attachment.libraryID;
      annotation.parentID = attachment.id;
      annotation.annotationType = "highlight";
      annotation.annotationText = "Compatibility test";
      annotation.annotationColor = "#ffd400";
      annotation.annotationPageLabel = "1";
      annotation.annotationSortIndex = "00000|000000|00000";
      annotation.annotationPosition = JSON.stringify({
        pageIndex: 0,
        rects: [[10, 10, 20, 20]],
      });
      await annotation.saveTx();

      await waitFor(
        () =>
          messages.some(
            (message) =>
              message.includes("event=add type=item") &&
              message.includes(String(annotation.id)),
          ),
        "annotation add event",
      );
    } catch (error) {
      // The test runner swallows non-standard error messages, so persist the
      // real error for debugging failed runs.
      await IOUtils.writeUTF8(
        PathUtils.join(PathUtils.tempDir, "zotero-wakatime-test-error.txt"),
        `${String(error)}\n${(error as any)?.stack ?? ""}`,
      );
      throw error;
    } finally {
      if (reader) reader.close();
      if (item) await item.eraseTx();
      Zotero.debug = originalDebug;
    }
  });
});
