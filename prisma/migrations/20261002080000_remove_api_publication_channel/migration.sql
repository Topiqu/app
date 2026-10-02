-- API consumers manage publishing on their own side, independently of tenant publication channels.
ALTER TABLE "ClientSite" DROP COLUMN "publishToApi";
