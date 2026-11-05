interface FieldMeta {
	errors: readonly ({ message: string } | undefined)[];
	isTouched: boolean;
}

/** The schema's first message for a field the user has touched, for `Field`'s `error`. */
export function fieldError({
	state: { meta },
}: {
	state: { meta: FieldMeta };
}) {
	return meta.isTouched ? meta.errors[0]?.message : undefined;
}
