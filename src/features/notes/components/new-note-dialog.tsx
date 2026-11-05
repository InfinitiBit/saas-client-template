import {
	AlertBanner,
	Button,
	Dialog,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Field,
	Input,
	Textarea,
} from '@infinitibit_gmbh/ui';
import { revalidateLogic, useForm } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

import {
	getListNotesQueryKey,
	useCreateNote,
} from '@/features/api/generated/service';
import { fieldError } from '@/features/notes/lib/field-error';
import { m } from '@/paraglide/messages';

const TITLE_MAX = 200;

// A factory, so the messages are read in the locale of the render that asks.
const noteSchema = () =>
	z.object({
		title: z
			.string()
			.trim()
			.min(1, m.notes_title_required())
			.max(TITLE_MAX, m.notes_title_too_long({ max: TITLE_MAX })),
		body: z.string(),
	});

/** "New note" and the dialog it opens. */
export function NewNoteDialog() {
	const [open, setOpen] = React.useState(false);

	return (
		<Dialog onOpenChange={setOpen} open={open}>
			<DialogTrigger asChild>
				<Button size="sm">{m.notes_new()}</Button>
			</DialogTrigger>
			<DialogContent
				closeLabel={m.notes_dialog_close()}
				// The body is a tab stop, so Radix would focus it before the first field.
				onOpenAutoFocus={(event) => {
					event.preventDefault();

					if (event.currentTarget instanceof HTMLElement)
						event.currentTarget
							.querySelector<HTMLElement>('[name="title"]')
							?.focus();
				}}
			>
				{/* Inside the content, so every opening starts from an empty form. */}
				<NewNoteForm onCreated={() => setOpen(false)} />
			</DialogContent>
		</Dialog>
	);
}

function NewNoteForm({ onCreated }: { onCreated: () => void }) {
	const queryClient = useQueryClient();

	const create = useCreateNote({
		mutation: {
			onSuccess: () => {
				void queryClient.invalidateQueries({
					queryKey: getListNotesQueryKey(),
				});
				toast.success(m.notes_created());
				onCreated();
			},
		},
	});

	const schema = noteSchema();

	const form = useForm({
		defaultValues: { title: '', body: '' },
		validationLogic: revalidateLogic(),
		validators: { onDynamic: schema },
		// The schema checks the values but hands them back untrimmed.
		onSubmit: ({ value }) => create.mutate({ data: schema.parse(value) }),
	});

	return (
		<form
			className="contents"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			<DialogHeader>
				<DialogTitle>{m.notes_new()}</DialogTitle>
			</DialogHeader>
			<DialogBody>
				<div className="flex flex-col gap-4">
					{/* In the dialog, not a toast: what was typed is still here to retry. */}
					{create.isError ? (
						<AlertBanner title={m.notes_create_error()} variant="error" />
					) : null}
					<form.Field name="title">
						{(field) => (
							<Field
								error={fieldError(field)}
								label={m.notes_field_title()}
								required
							>
								<Input
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									value={field.state.value}
								/>
							</Field>
						)}
					</form.Field>
					<form.Field name="body">
						{(field) => (
							<Field error={fieldError(field)} label={m.notes_field_body()}>
								<Textarea
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									value={field.state.value}
								/>
							</Field>
						)}
					</form.Field>
				</div>
			</DialogBody>
			<DialogFooter>
				<DialogClose asChild>
					<Button variant="secondary">{m.notes_cancel()}</Button>
				</DialogClose>
				<Button disabled={create.isPending} type="submit">
					{m.notes_create()}
				</Button>
			</DialogFooter>
		</form>
	);
}
