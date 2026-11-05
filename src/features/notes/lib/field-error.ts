interface FieldMeta {
	errors: readonly ({ message: string } | undefined)[];
	isTouched: boolean;
}

export function fieldError({
	state: { meta },
}: {
	state: { meta: FieldMeta };
}) {
	return meta.isTouched ? meta.errors[0]?.message : undefined;
}
