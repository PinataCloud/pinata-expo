import { Hono } from "hono";
import { cors } from "hono/cors";
import { PinataSDK } from "pinata";

interface Bindings {
	PINATA_JWT: string;
	GATEWAY_URL: string;
	DEV_PINATA_JWT: string;
	DEV_GATEWAY_URL: string;
	DEV_UPLOAD_URL: string;
	DEV_ENDPOINT_URL: string;
}

const app = new Hono<{ Bindings: Bindings }>();

app.use(cors());

app.get("/", (c) => {
	return c.text("Hello Hono!");
});

app.get("/presigned_url", async (c) => {
	// Handle Auth

	const pinata = new PinataSDK({
		pinataJwt: c.env.PINATA_JWT,
		pinataGateway: c.env.GATEWAY_URL,
	});

	const url = await pinata.upload.public.createSignedURL({
		expires: 3600,
		streamable: true,
	});

	return c.json({ url }, { status: 200 });
});

app.get("/file/:id", async (c) => {
	const fileId = c.req.param("id");

	const pinata = new PinataSDK({
		pinataJwt: c.env.DEV_PINATA_JWT,
		pinataGateway: c.env.DEV_GATEWAY_URL,
		uploadUrl: c.env.DEV_UPLOAD_URL,
		endpointUrl: c.env.DEV_ENDPOINT_URL,
	});

	const file = await pinata.files.public.get(fileId);

	const url = await pinata.gateways.public.convert(file.cid);

	return c.json({ url });
});

export default app;
