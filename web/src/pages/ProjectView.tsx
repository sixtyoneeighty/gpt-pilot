import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Typography,
  Box,
  Paper,
  Divider,
  TextField,
  Button,
  CircularProgress,
  Chip,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Tab,
  Tabs,
} from '@mui/material';
import { useWebSocket } from '../hooks/useWebSocket';
import ModelSelector from '../components/ModelSelector';

interface Message {
  type: string;
  message?: string;
  chunk?: string;
  source?: string;
  source_display_name?: string;
  question_id?: string;
  question?: string;
  buttons?: Record<string, string>;
  buttons_only?: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
      style={{ height: '100%' }}
    >
      {value === index && (
        <Box sx={{ p: 3, height: '100%' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const ProjectView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { connected, messages, sendResponse } = useWebSocket();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [userInput, setUserInput] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState<Message | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Filter messages for this project
  const projectMessages = messages.filter(
    (msg) => msg.project_state_id === id || !msg.project_state_id
  );

  useEffect(() => {
    // Simulate loading project data
    setTimeout(() => {
      setProjectName(`Project ${id}`);
      setLoading(false);
    }, 1000);
  }, [id]);

  useEffect(() => {
    // Find the latest question message
    const questionMsg = [...projectMessages]
      .reverse()
      .find((msg) => msg.type === 'question' && !msg.answered);
    
    if (questionMsg && questionMsg !== currentQuestion) {
      setCurrentQuestion(questionMsg);
    }
  }, [projectMessages, currentQuestion]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [projectMessages]);

  const handleSendResponse = () => {
    if (!currentQuestion || !currentQuestion.question_id) return;

    if (currentQuestion.buttons_only && currentQuestion.buttons) {
      // If buttons only, don't allow text input
      return;
    }

    sendResponse(currentQuestion.question_id, {
      text: userInput,
      cancelled: false,
    });

    // Mark question as answered
    setCurrentQuestion({ ...currentQuestion, answered: true });
    setUserInput('');
  };

  const handleButtonClick = (buttonKey: string) => {
    if (!currentQuestion || !currentQuestion.question_id) return;

    sendResponse(currentQuestion.question_id, {
      button: buttonKey,
      cancelled: false,
    });

    // Mark question as answered
    setCurrentQuestion({ ...currentQuestion, answered: true });
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleModelChange = (provider: string, model: string) => {
    console.log(`Selected provider: ${provider}, model: ${model}`);
    // Here you would implement the actual model change logic
    // This could involve sending a message to the backend via WebSocket
    sendResponse('model_change', {
      provider,
      model
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: 'calc(100vh - 140px)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4" component="h1">
          {projectName}
        </Typography>
        <Chip
          label={connected ? 'Connected' : 'Disconnected'}
          color={connected ? 'success' : 'error'}
          size="small"
        />
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="project tabs">
          <Tab label="Chat" />
          <Tab label="Tasks" />
          <Tab label="Files" />
          <Tab label="Settings" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Paper
            elevation={3}
            sx={{
              p: 2,
              flexGrow: 1,
              mb: 2,
              overflowY: 'auto',
              maxHeight: 'calc(100% - 80px)',
            }}
          >
            {projectMessages.length === 0 ? (
              <Typography variant="body1" color="text.secondary" align="center">
                No messages yet. Start interacting with GPT Pilot.
              </Typography>
            ) : (
              projectMessages.map((msg, index) => {
                if (msg.type === 'message' || msg.type === 'stream') {
                  return (
                    <Box
                      key={index}
                      sx={{
                        mb: 2,
                        p: 1,
                        borderRadius: 1,
                        bgcolor: msg.source?.startsWith('agent:')
                          ? 'background.paper'
                          : 'primary.dark',
                      }}
                    >
                      {msg.source_display_name && (
                        <Typography variant="subtitle2" fontWeight="bold">
                          {msg.source_display_name}:
                        </Typography>
                      )}
                      <Typography variant="body1">
                        {msg.message || msg.chunk}
                      </Typography>
                    </Box>
                  );
                }
                return null;
              })
            )}
            <div ref={messagesEndRef} />
          </Paper>

          {currentQuestion && !currentQuestion.answered && (
            <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                {currentQuestion.source_display_name || 'System'}:
              </Typography>
              <Typography variant="body1" paragraph>
                {currentQuestion.question}
              </Typography>

              {currentQuestion.buttons && (
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  {Object.entries(currentQuestion.buttons).map(([key, label]) => (
                    <Button
                      key={key}
                      variant="outlined"
                      onClick={() => handleButtonClick(key)}
                    >
                      {label}
                    </Button>
                  ))}
                </Box>
              )}

              {!currentQuestion.buttons_only && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Type your response..."
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendResponse();
                      }
                    }}
                    multiline
                    rows={2}
                  />
                  <Button
                    variant="contained"
                    onClick={handleSendResponse}
                    disabled={!userInput.trim()}
                  >
                    Send
                  </Button>
                </Box>
              )}
            </Paper>
          )}
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Current Tasks
                </Typography>
                <List>
                  <ListItem>
                    <ListItemText
                      primary="Setup project structure"
                      secondary="In progress"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Implement authentication"
                      secondary="Pending"
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Completed Tasks
                </Typography>
                <List>
                  <ListItem>
                    <ListItemText
                      primary="Project initialization"
                      secondary="Completed"
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Typography variant="body1">
          File browser will be implemented in a future update.
        </Typography>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Box sx={{ maxWidth: 'md', mx: 'auto' }}>
          <Typography variant="h5" gutterBottom>
            Project Settings
          </Typography>
          <ModelSelector onModelChange={handleModelChange} />
          
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Advanced Settings
            </Typography>
            <Typography variant="body2" color="text.secondary">
              More settings will be available in future updates.
            </Typography>
          </Paper>
        </Box>
      </TabPanel>
    </Box>
  );
};

export default ProjectView; 