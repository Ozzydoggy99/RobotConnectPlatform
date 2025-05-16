import TaskCreationForm from "@/components/tasks/TaskCreationForm";

export default function TaskCreatePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Create New Task</h1>
        <p className="text-sm text-gray-600 mt-1">Define a new task for your robots</p>
      </div>
      
      <TaskCreationForm />
    </div>
  );
}
