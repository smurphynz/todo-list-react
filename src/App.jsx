import React, { useState } from "react";
import "./styles.css";

function App() {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");

  const addTask = () => {
    if (newTask.trim() !== "") {
      setTasks([...tasks, { text: newTask, completed: false }]);
      setNewTask("");
    }
  };

  const deleteTask = (index) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const toggleTaskCompletion = (index) => {
    setTasks(
      tasks.map((task, i) =>
        i === index ? { ...task, completed: !task.completed } : task
      )
    );
  };

  return (
    <div>
      <h1>Fuge To-Do List</h1>
      <input
        type="text"
        value={newTask}
        onChange={(e) => setNewTask(e.target.value)}
        placeholder="Enter a task..."
      />
      <button onClick={addTask}>Add</button>

      <ul>
        {tasks.map((task, index) => (
          <li key={index}>
            <span>{task.text}</span>
            <div>
              <button
                className={task.completed ? "completed" : "complete"}
                onClick={() => toggleTaskCompletion(index)}
              >
                {task.completed ? "✅" : "✔️"}
              </button>
              <button className="delete" onClick={() => deleteTask(index)}>❌</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;


